import { withTransaction } from "@/database";
import payoutProviderRegistry from "@/services/payouts/payoutProviderRegistry";
import PayoutProviderError from "@/services/payouts/payoutProviderError";
import createWithdrawalRefund from "@/actions/withdrawalRefund/createWithdrawalRefund";
import syncWithdrawal from "@/actions/withdrawal/syncWithdrawal";
import monitoring from "@/utils/monitoring";
import updateWithdrawalSubmitted from "../../queries/updateWithdrawalSubmitted";
import updateWithdrawalProcessing from "../../queries/updateWithdrawalProcessing";
import WITHDRAWALS, { PAYOUT_PROVIDER_ERROR_CODE, PROVIDER_PAYOUT_STATUS } from "@/constants/withdrawals";

const DECLINED = "Your bank transfer was declined. Your money has been returned.";
const UNAVAILABLE = "Withdrawals are temporarily unavailable. Your money has been returned.";

/**
 * Sends an already-held withdrawal to ITS provider (the one on the row). The money is safe whatever happens:
 *   accepted                 → stays pending until confirmed (webhook / follow-up checks / reconciler)
 *   rejected / configuration → definitely not sent → refunded now
 *   anything else            → outcome unknown → `processing`, never refunded on a guess
 */
const submitWithdrawal = async ({
    withdrawalId,
    provider,
    providerBankId,
    accountNumber,
    accountName,
    amount,
    customer,
}: {
    withdrawalId: string;
    provider: string;
    providerBankId: string;
    accountNumber: string;
    accountName: string;
    amount: string;
    customer: { name: string; email: string | null };
}) => {
    try {
        const payout = await payoutProviderRegistry.get({ name: provider }).sendPayout({
            externalId: withdrawalId,
            providerBankId,
            accountNumber,
            accountName,
            amount: { amount, currency: WITHDRAWALS.CURRENCY },
            narration: WITHDRAWALS.NARRATION,
            customer,
        });
        await updateWithdrawalSubmitted({ id: withdrawalId, providerReference: payout.providerReference });
        if (payout.status !== PROVIDER_PAYOUT_STATUS.PENDING) await syncWithdrawal({ withdrawalId });
    } catch (error) {
        const code = error instanceof PayoutProviderError ? error.code : null;
        if (code === PAYOUT_PROVIDER_ERROR_CODE.REJECTED || code === PAYOUT_PROVIDER_ERROR_CODE.CONFIGURATION) {
            if (code === PAYOUT_PROVIDER_ERROR_CODE.CONFIGURATION) {
                monitoring.error(`Withdrawal ${withdrawalId}: ${provider} refused our setup — check keys / IP whitelist / balance`, error as Error);
            }
            const reason = code === PAYOUT_PROVIDER_ERROR_CODE.REJECTED ? DECLINED : UNAVAILABLE;
            await withTransaction((trx) => createWithdrawalRefund({ trx, withdrawalId, reason }));
            return;
        }
        monitoring.warn(`Withdrawal ${withdrawalId}: outcome unknown at ${provider} (${code ?? "error"}) — will reconcile`);
        await updateWithdrawalProcessing({ id: withdrawalId });
    }
};

export default submitWithdrawal;
