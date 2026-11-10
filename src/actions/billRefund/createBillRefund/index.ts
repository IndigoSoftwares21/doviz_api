import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import selectRefundPaymentForUpdate from "./queries/selectRefundPaymentForUpdate";
import updateBillPaymentFailed from "./queries/updateBillPaymentFailed";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { BILL_PAYMENT_STATUS } from "@/constants/bills";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

const FINAL: string[] = [BILL_PAYMENT_STATUS.COMPLETED, BILL_PAYMENT_STATUS.FAILED];

/**
 * Returns the full held amount (incl. service fee) to the user, inside the
 * caller's transaction. Only for payments the provider definitely didn't
 * deliver. `reason` is shown to the user. Does nothing if already final.
 */
const createBillRefund = async ({ trx, billPaymentId, reason }: { trx: Kysely<Database>; billPaymentId: string; reason: string }) => {
    const payment = await selectRefundPaymentForUpdate({ trx, id: billPaymentId });
    if (FINAL.includes(payment.status)) return { data: { refunded: false } };

    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `bill-refund:${payment.id}`,
        type: LEDGER_TRANSACTION_TYPE.BILL_REVERSAL,
        description: "Bill payment refunded",
        currency: payment.currency,
        metadata: { billPaymentId: payment.id, provider: payment.provider, reason },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, provider: payment.provider }, amount: new Decimal(payment.total).negated().toFixed(2) },
            { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: payment.userId }, amount: new Decimal(payment.total).toFixed(2) },
        ],
    });

    await updateBillPaymentFailed({ trx, id: payment.id, failureReason: reason, ledgerTransactionId: posting.transactionId });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.BILL_PAYMENT_REFUNDED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.BILL_PAYMENT,
        entityId: payment.id,
        metadata: { billPaymentId: payment.id, provider: payment.provider, total: payment.total, reason },
    });

    return { data: { refunded: true } };
};

export default createBillRefund;
