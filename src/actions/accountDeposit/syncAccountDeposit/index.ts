import { withTransaction } from "@/database";
import getVirtualAccountProvider from "@/services/virtualAccounts/getVirtualAccountProvider";
import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import createNairaDepositCredit from "@/actions/nairaDepositCredit/createNairaDepositCredit";
import monitoring from "@/utils/monitoring";
import selectAccountByNumber from "./queries/selectAccountByNumber";
import insertAccountDeposit from "./queries/insertAccountDeposit";
import { SYNC_OUTCOME } from "@/constants/cryptoStatus";

/**
 * Credits a payment into a user's account number. Provider-agnostic: the
 * provider that issued the account re-fetches the payment (a webhook body is
 * never trusted for money), the account number finds the user, and the same
 * naira-deposit credit runs for every provider. Idempotent: a payment is
 * recorded and credited once, however many times this runs.
 */
const syncAccountDeposit = async ({ provider: providerName, reference }: { provider: string; reference: string }) => {
    const provider = getVirtualAccountProvider({ name: providerName });
    const deposit = await provider.getDeposit({ reference });
    if (deposit?.status === "failed") return { data: { outcome: SYNC_OUTCOME.IGNORED } };
    // Not visible or not settled yet (provider records can lag the webhook; Squad may hold a
    // payment for review): throw so the webhook sweeper retries — never drop money silently.
    if (!deposit || deposit.status !== "completed") throw new Error(`${provider.name} payment ${reference} is ${deposit ? deposit.status : "not found"} — will retry`);

    const account = await selectAccountByNumber({ provider: provider.name, accountNumber: deposit.accountNumber });
    if (!account) {
        monitoring.error(`${provider.name} payment ${reference} went to an account number we don't know — needs review`, new Error("unknown account"));
        return { data: { outcome: SYNC_OUTCOME.IGNORED } };
    }

    const credited = await withTransaction(async (trx) => {
        const nairaDepositId = await insertAccountDeposit({
            trx,
            values: {
                userId: account.userId,
                provider: provider.name,
                reference: deposit.reference,
                amount: deposit.amount.amount,
                currency: deposit.amount.currency,
                feeBearer: collectionProviderRegistry.feeBearer(),
                accountNumber: account.accountNumber,
                accountName: account.accountName,
                bankName: account.bankName,
            },
        });
        const { data } = await createNairaDepositCredit({
            trx,
            nairaDepositId,
            record: {
                externalId: nairaDepositId,
                providerReference: deposit.reference,
                status: "completed",
                amountPaid: deposit.amount,
                fee: deposit.fee,
                paidAt: deposit.paidAt,
                sender: deposit.sender,
            },
        });
        return data.credited;
    });

    return { data: { outcome: credited ? SYNC_OUTCOME.CREDITED : SYNC_OUTCOME.UNCHANGED } };
};

export default syncAccountDeposit;
