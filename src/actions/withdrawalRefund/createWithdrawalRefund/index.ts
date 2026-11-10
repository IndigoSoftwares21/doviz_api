import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import selectWithdrawalForRefund from "./queries/selectWithdrawalForRefund";
import updateWithdrawalFailed from "./queries/updateWithdrawalFailed";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { WITHDRAWAL_STATUS } from "@/constants/withdrawals";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

const FINAL: string[] = [WITHDRAWAL_STATUS.COMPLETED, WITHDRAWAL_STATUS.FAILED];

/**
 * Returns everything held (amount + fee reserve) to the user, inside the
 * caller's transaction. Only for payouts the provider definitely didn't make.
 * `reason` is shown to the user. Does nothing once final.
 */
const createWithdrawalRefund = async ({ trx, withdrawalId, reason }: { trx: Kysely<Database>; withdrawalId: string; reason: string }) => {
    const withdrawal = await selectWithdrawalForRefund({ trx, id: withdrawalId });
    if (FINAL.includes(withdrawal.status)) return { data: { refunded: false } };

    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `withdrawal-refund:${withdrawal.id}`,
        type: LEDGER_TRANSACTION_TYPE.WITHDRAWAL_REVERSAL,
        description: "Withdrawal refunded",
        currency: withdrawal.currency,
        metadata: { withdrawalId: withdrawal.id, provider: withdrawal.provider, reason },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.PAYOUTS_IN_TRANSIT, provider: withdrawal.provider }, amount: new Decimal(withdrawal.totalHeld).negated().toFixed(2) },
            { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: withdrawal.userId }, amount: new Decimal(withdrawal.totalHeld).toFixed(2) },
        ],
    });

    await updateWithdrawalFailed({ trx, id: withdrawal.id, failureReason: reason, ledgerTransactionId: posting.transactionId });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.WITHDRAWAL_REFUNDED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.BANK_WITHDRAWAL,
        entityId: withdrawal.id,
        metadata: { withdrawalId: withdrawal.id, provider: withdrawal.provider, total: withdrawal.totalHeld, reason },
    });

    await publishUserEvent({ trx, userId: withdrawal.userId, event: REALTIME_EVENT.WITHDRAWAL_UPDATED, data: { withdrawalId: withdrawal.id, status: "failed" } });
    await publishUserEvent({ trx, userId: withdrawal.userId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });

    return { data: { refunded: true } };
};

export default createWithdrawalRefund;
