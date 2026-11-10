import { withTransaction } from "@/database";
import payoutProviderRegistry from "@/services/payouts/payoutProviderRegistry";
import createWithdrawalSettlement from "@/actions/withdrawalSettlement/createWithdrawalSettlement";
import createWithdrawalRefund from "@/actions/withdrawalRefund/createWithdrawalRefund";
import monitoring from "@/utils/monitoring";
import selectWithdrawalForSync from "./queries/selectWithdrawalForSync";
import updateWithdrawalChecked from "./queries/updateWithdrawalChecked";
import WITHDRAWALS, { PROVIDER_PAYOUT_STATUS, WITHDRAWAL_STATUS, WITHDRAWAL_SYNC_OUTCOME, WithdrawalSyncOutcome } from "@/constants/withdrawals";

const FINAL: string[] = [WITHDRAWAL_STATUS.COMPLETED, WITHDRAWAL_STATUS.FAILED];

/**
 * Brings one withdrawal in line with ITS provider's own record (the provider
 * on the row — never the active one, so a switch mid-flight is harmless).
 * Safe to call any number of times: settle and refund lock the row and do
 * nothing once final. Not found: refunded after a grace period ONLY if the
 * provider never acknowledged it; an acknowledged one is flagged for a person.
 */
const syncWithdrawal = async ({ withdrawalId }: { withdrawalId: string }) => {
    const withdrawal = await selectWithdrawalForSync({ id: withdrawalId });
    if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found`);
    if (FINAL.includes(withdrawal.status)) return { data: { outcome: WITHDRAWAL_SYNC_OUTCOME.UNCHANGED as WithdrawalSyncOutcome } };

    const record = await payoutProviderRegistry.get({ name: withdrawal.provider }).getPayout({ externalId: withdrawal.id });

    const outcome = await withTransaction(async (trx): Promise<WithdrawalSyncOutcome> => {
        if (record?.status === PROVIDER_PAYOUT_STATUS.COMPLETED) {
            const { data } = await createWithdrawalSettlement({ trx, withdrawalId: withdrawal.id, record });
            return data.settled ? WITHDRAWAL_SYNC_OUTCOME.COMPLETED : WITHDRAWAL_SYNC_OUTCOME.UNCHANGED;
        }

        if (record?.status === PROVIDER_PAYOUT_STATUS.FAILED) {
            const reason = "Your bank transfer didn't go through. Your money has been returned.";
            const { data } = await createWithdrawalRefund({ trx, withdrawalId: withdrawal.id, reason });
            return data.refunded ? WITHDRAWAL_SYNC_OUTCOME.REFUNDED : WITHDRAWAL_SYNC_OUTCOME.UNCHANGED;
        }

        const overdue = Date.now() - withdrawal.requestedAt.getTime() > WITHDRAWALS.NOT_FOUND_REFUND_AFTER_MS;
        if (!record && overdue) {
            if (!withdrawal.providerReference) {
                const reason = "This withdrawal didn't go through. Your money has been returned.";
                const { data } = await createWithdrawalRefund({ trx, withdrawalId: withdrawal.id, reason });
                return data.refunded ? WITHDRAWAL_SYNC_OUTCOME.REFUNDED : WITHDRAWAL_SYNC_OUTCOME.UNCHANGED;
            }
            await updateWithdrawalChecked({ trx, id: withdrawal.id, providerReference: null });
            return WITHDRAWAL_SYNC_OUTCOME.NEEDS_REVIEW;
        }

        await updateWithdrawalChecked({ trx, id: withdrawal.id, providerReference: record?.providerReference ?? null });
        return WITHDRAWAL_SYNC_OUTCOME.PENDING;
    });

    if (outcome === WITHDRAWAL_SYNC_OUTCOME.NEEDS_REVIEW) {
        monitoring.error(`Withdrawal ${withdrawal.id} (${withdrawal.provider}) was acknowledged but can't be found — needs review`, new Error("withdrawal not found"));
    }

    return { data: { outcome } };
};

export default syncWithdrawal;
