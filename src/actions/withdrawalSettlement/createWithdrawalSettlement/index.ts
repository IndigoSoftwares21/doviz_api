import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { ProviderPayout } from "@/services/payouts/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import monitoring from "@/utils/monitoring";
import selectWithdrawalForSettlement from "./queries/selectWithdrawalForSettlement";
import selectUserAvailableBalance from "./queries/selectUserAvailableBalance";
import updateWithdrawalCompleted from "./queries/updateWithdrawalCompleted";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { WITHDRAWAL_STATUS } from "@/constants/withdrawals";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

const FINAL: string[] = [WITHDRAWAL_STATUS.COMPLETED, WITHDRAWAL_STATUS.FAILED];
const ZERO = new Decimal(0);

/**
 * Settles a payout the provider confirmed, inside the caller's transaction.
 * The user pays the provider's REAL fee:
 *   payouts_in_transit  −held             (amount + fee reserve)
 *   provider_clearing   +(amount + fee)   (what left Doviz's balance at the provider)
 *   user_available      +(reserve − fee)  unused reserve straight back, or
 *                       −(fee − reserve)  the rest of a higher fee, from their balance
 *   provider_fees       −shortfall        only what their balance can't cover (Doviz absorbs, alerted)
 * A provider that never reports the fee is charged at the reserve. Does nothing once final.
 */
const createWithdrawalSettlement = async ({ trx, withdrawalId, record }: { trx: Kysely<Database>; withdrawalId: string; record: ProviderPayout }) => {
    const withdrawal = await selectWithdrawalForSettlement({ trx, id: withdrawalId });
    if (FINAL.includes(withdrawal.status)) return { data: { settled: false } };

    if (record.fee && record.fee.currency !== withdrawal.currency) {
        throw new Error(`Withdrawal ${withdrawal.id}: fee in ${record.fee.currency}, withdrawal in ${withdrawal.currency} — manual review`);
    }
    if (!record.fee) monitoring.warn(`Withdrawal ${withdrawal.id}: ${withdrawal.provider} reported no fee — charging the reserve`);

    const reserve = new Decimal(withdrawal.feeReserve);
    const fee = record.fee ? new Decimal(record.fee.amount) : reserve;
    const release = Decimal.max(ZERO, reserve.minus(fee));
    const extra = Decimal.max(ZERO, fee.minus(reserve));

    let taken = ZERO;
    if (extra.greaterThan(0)) {
        const balance = await selectUserAvailableBalance({ trx, userId: withdrawal.userId, currency: withdrawal.currency });
        taken = Decimal.min(extra, new Decimal(balance?.balance ?? 0));
    }
    const absorbed = extra.minus(taken);
    if (absorbed.greaterThan(0)) {
        monitoring.error(`Withdrawal ${withdrawal.id}: fee ₦${fee.toFixed(2)} above reserve and balance — Doviz absorbs ₦${absorbed.toFixed(2)}`, new Error("withdrawal fee shortfall"));
    }

    const userEntry = release.minus(taken);
    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `withdrawal-settle:${withdrawal.id}`,
        type: LEDGER_TRANSACTION_TYPE.WITHDRAWAL_SETTLE,
        description: release.greaterThan(0) ? "Unused withdrawal fee returned" : "Withdrawal fee",
        currency: withdrawal.currency,
        metadata: { withdrawalId: withdrawal.id, provider: withdrawal.provider, fee: fee.toFixed(2), reserve: reserve.toFixed(2) },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.PAYOUTS_IN_TRANSIT, provider: withdrawal.provider }, amount: new Decimal(withdrawal.totalHeld).negated().toFixed(2) },
            { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: withdrawal.provider }, amount: new Decimal(withdrawal.amount).plus(fee).toFixed(2) },
            ...(userEntry.isZero() ? [] : [{ account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: withdrawal.userId }, amount: userEntry.toFixed(2) }]),
            ...(absorbed.isZero() ? [] : [{ account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_FEES, provider: withdrawal.provider }, amount: absorbed.negated().toFixed(2) }]),
        ],
    });

    await updateWithdrawalCompleted({ trx, id: withdrawal.id, fee: fee.toFixed(2), providerReference: record.providerReference, ledgerTransactionId: posting.transactionId });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.WITHDRAWAL_COMPLETED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.BANK_WITHDRAWAL,
        entityId: withdrawal.id,
        metadata: { withdrawalId: withdrawal.id, provider: withdrawal.provider, amount: withdrawal.amount, fee: fee.toFixed(2), absorbed: absorbed.toFixed(2) },
    });

    await publishUserEvent({ trx, userId: withdrawal.userId, event: REALTIME_EVENT.WITHDRAWAL_UPDATED, data: { withdrawalId: withdrawal.id, status: "completed" } });
    if (!userEntry.isZero()) await publishUserEvent({ trx, userId: withdrawal.userId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });

    return { data: { settled: true } };
};

export default createWithdrawalSettlement;
