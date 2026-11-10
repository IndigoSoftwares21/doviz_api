import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { ProviderBillPayment } from "@/services/bills/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import { REALTIME_EVENT } from "@/constants/realtime";
import selectSettlementPaymentForUpdate from "./queries/selectSettlementPaymentForUpdate";
import updateBillPaymentCompleted from "./queries/updateBillPaymentCompleted";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { BILL_PAYMENT_STATUS } from "@/constants/bills";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

const FINAL: string[] = [BILL_PAYMENT_STATUS.COMPLETED, BILL_PAYMENT_STATUS.FAILED];

/**
 * Settles a payment the provider confirmed, inside the caller's transaction:
 * the held money leaves `bills_in_transit` — the provider's cost against
 * Doviz's float at that provider, the rest (service fee + commission) to
 * `bill_revenue`. Cost = what the provider says it charged, else the face
 * amount. Does nothing if the payment is already final. Throws rather than
 * guess when the provider reports a different currency.
 */
const createBillSettlement = async ({ trx, billPaymentId, record }: { trx: Kysely<Database>; billPaymentId: string; record: ProviderBillPayment }) => {
    const payment = await selectSettlementPaymentForUpdate({ trx, id: billPaymentId });
    if (FINAL.includes(payment.status)) return { data: { settled: false } };

    const cost = record.cost ?? { amount: payment.amount, currency: payment.currency };
    if (cost.currency !== payment.currency) {
        throw new Error(`Bill payment ${payment.id}: provider cost in ${cost.currency}, payment in ${payment.currency} — manual review`);
    }
    const providerCost = new Decimal(cost.amount).toFixed(2);
    const revenue = new Decimal(payment.total).minus(providerCost);

    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `bill-settle:${payment.id}`,
        type: LEDGER_TRANSACTION_TYPE.BILL_SETTLE,
        description: "Bill payment delivered",
        currency: payment.currency,
        metadata: { billPaymentId: payment.id, provider: payment.provider, providerReference: record.providerReference },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, provider: payment.provider }, amount: new Decimal(payment.total).negated().toFixed(2) },
            { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: payment.provider }, amount: providerCost },
            ...(revenue.isZero() ? [] : [{ account: { kind: LEDGER_ACCOUNT_KIND.BILL_REVENUE }, amount: revenue.toFixed(2) }]),
        ],
    });

    await updateBillPaymentCompleted({
        trx,
        id: payment.id,
        providerCost,
        providerReference: record.providerReference,
        token: record.token,
        ledgerTransactionId: posting.transactionId,
    });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.BILL_PAYMENT_COMPLETED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.BILL_PAYMENT,
        entityId: payment.id,
        metadata: { billPaymentId: payment.id, provider: payment.provider, total: payment.total, providerCost },
    });

    await publishUserEvent({ trx, userId: payment.userId, event: REALTIME_EVENT.BILL_PAYMENT_UPDATED, data: { billPaymentId: payment.id, status: "completed" } });

    return { data: { settled: true } };
};

export default createBillSettlement;
