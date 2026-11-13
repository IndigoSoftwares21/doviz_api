import { PayoutProvider } from "@/services/payouts/payoutProvider";
import PayoutProviderError from "@/services/payouts/payoutProviderError";
import { canSendToOthers } from "@/actions/appSettings/fetchAppSetting";
import selectQuoteBankAccount from "../../queries/selectQuoteBankAccount";
import selectRecipientBank from "../../queries/selectRecipientBank";
import selectProviderBankId from "../../queries/selectProviderBankId";
import ACTION_FAILURE, { ActionFailure } from "@/constants/actionFailure";
import { PAYOUT_PROVIDER_ERROR_CODE } from "@/constants/withdrawals";

/** Where a withdrawal goes: one of the user's own saved accounts, or any account (bank + number). */
export type WithdrawalDestination = { bankAccountId: string } | { payoutBankId: string; accountNumber: string };

export interface ResolvedDestination {
    /** Set for the user's own saved account; null for someone else's. */
    bankAccountId: string | null;
    payoutBankId: string;
    bankName: string;
    accountNumber: string;
    /** For someone else's account: the name THEIR bank returned just now. */
    accountName: string;
    providerBankId: string;
}

/**
 * The destination with the active provider's code for its bank. Someone
 * else's account needs the bank_transfers_to_others switch on, and its name
 * is looked up with the provider now — never taken from the app.
 */
const resolveDestination = async ({ userId, destination, provider }: { userId: string; destination: WithdrawalDestination; provider: PayoutProvider }): Promise<{ data: ResolvedDestination | null; failure: ActionFailure | null }> => {
    const fail = (failure: ActionFailure) => ({ data: null, failure });
    if ("bankAccountId" in destination) {
        const own = await selectQuoteBankAccount({ bankAccountId: destination.bankAccountId, userId });
        const mapping = await selectProviderBankId({ payoutBankId: own.payoutBankId, provider: provider.name, environment: provider.environment });
        if (!mapping) return fail(ACTION_FAILURE.BANK_UNSUPPORTED);
        return { data: { bankAccountId: own.id, payoutBankId: own.payoutBankId, bankName: own.bankName, accountNumber: own.accountNumber, accountName: own.accountName, providerBankId: mapping.providerBankId }, failure: null };
    }

    if (!(await canSendToOthers())) return fail(ACTION_FAILURE.TRANSFERS_TO_OTHERS_OFF);
    const bank = await selectRecipientBank({ payoutBankId: destination.payoutBankId });
    const mapping = bank ? await selectProviderBankId({ payoutBankId: bank.id, provider: provider.name, environment: provider.environment }) : null;
    if (!bank || !mapping) return fail(ACTION_FAILURE.BANK_UNSUPPORTED);
    try {
        const { accountName } = await provider.resolveAccount({ providerBankId: mapping.providerBankId, accountNumber: destination.accountNumber });
        return { data: { bankAccountId: null, payoutBankId: bank.id, bankName: bank.name, accountNumber: destination.accountNumber, accountName, providerBankId: mapping.providerBankId }, failure: null };
    } catch (error) {
        const refused = error instanceof PayoutProviderError && (error.code === PAYOUT_PROVIDER_ERROR_CODE.REJECTED || error.code === PAYOUT_PROVIDER_ERROR_CODE.NOT_FOUND);
        if (!refused) throw error;
        return fail(ACTION_FAILURE.RECIPIENT_ACCOUNT_NOT_FOUND);
    }
};

export default resolveDestination;
