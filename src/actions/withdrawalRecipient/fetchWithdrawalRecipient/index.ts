import fetchActivePayoutProvider from "@/actions/payoutProvider/fetchActivePayoutProvider";
import resolveDestination from "@/actions/withdrawalQuote/fetchWithdrawalQuote/utils/resolveDestination";

/**
 * The name on someone else's bank account, as their bank returns it — shown as
 * soon as the number is typed, before any amount. Needs the
 * bank_transfers_to_others switch on. The send looks it up again; this is only for the user to check.
 */
const fetchWithdrawalRecipient = async ({ userId, payoutBankId, accountNumber }: { userId: string; payoutBankId: string; accountNumber: string }) => {
    const { data: provider } = await fetchActivePayoutProvider();
    const { data, failure } = await resolveDestination({ userId, destination: { payoutBankId, accountNumber }, provider });
    return { data: data ? { bankName: data.bankName, accountNumber: data.accountNumber, accountName: data.accountName } : null, failure };
};

export default fetchWithdrawalRecipient;
