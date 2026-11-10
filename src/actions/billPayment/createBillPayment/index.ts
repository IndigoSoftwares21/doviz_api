import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import { withTransaction } from "@/database";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchBillPayment from "@/actions/billPayment/fetchBillPayment";
import selectBillPaymentIdByIdempotencyKey from "./queries/selectBillPaymentIdByIdempotencyKey";
import selectPaymentProduct from "./queries/selectPaymentProduct";
import insertBillPayment from "./queries/insertBillPayment";
import submitBillPayment from "./utils/submitBillPayment";
import isInsufficientBalanceError from "./utils/isInsufficientBalanceError";
import isIdempotencyConflictError from "./utils/isIdempotencyConflictError";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { BILL_AMOUNT_TYPE } from "@/constants/bills";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface ICreateBillPayment {
    userId: string;
    productId: string;
    customerId: string;
    /** Required for range products; ignored (the price is used) for fixed ones. */
    amount: string | null;
    idempotencyKey: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Pays a bill from the user's balance: PIN → hold the money and record the
 * payment (one transaction; the ledger refuses an overdraft) → send it to
 * the provider → return it. Repeating a request with the same idempotency
 * key returns the original payment instead of paying twice.
 */
const createBillPayment = async ({ userId, productId, customerId, amount, idempotencyKey, pin, ipAddress, userAgent }: ICreateBillPayment) => {
    const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return { data: null, failure: ACTION_FAILURE.PIN, verification, isNew: false };

    const replay = async () => {
        const existing = await selectBillPaymentIdByIdempotencyKey({ userId, idempotencyKey });
        if (!existing) return null;
        const { data } = await fetchBillPayment({ userId, billPaymentId: existing.id, refresh: false });
        return { data, failure: null, verification, isNew: false };
    };

    const previous = await replay();
    if (previous) return previous;

    const product = await selectPaymentProduct({ productId });
    const chargeAmount = new Decimal(product.amountType === BILL_AMOUNT_TYPE.FIXED ? product.price! : amount!).toFixed(2);
    const total = new Decimal(chargeAmount).plus(product.serviceFee).toFixed(2);
    const id = randomUUID();

    try {
        await withTransaction(async (trx) => {
            const { data: hold } = await createLedgerPosting({
                trx,
                idempotencyKey: `bill-hold:${id}`,
                type: LEDGER_TRANSACTION_TYPE.BILL_HOLD,
                description: `${product.billerName} ${product.productName}`.slice(0, 255),
                currency: product.currency,
                metadata: { billPaymentId: id, productId, provider: product.provider },
                entries: [
                    { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: new Decimal(total).negated().toFixed(2) },
                    { account: { kind: LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, provider: product.provider }, amount: total },
                ],
            });

            await insertBillPayment({
                trx,
                id,
                userId,
                productId,
                billerId: product.billerId,
                provider: product.provider,
                idempotencyKey,
                customerId,
                currency: product.currency,
                amount: chargeAmount,
                serviceFee: product.serviceFee,
                total,
                holdLedgerTransactionId: hold.transactionId,
            });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.BILL_PAYMENT_REQUESTED,
                actorType: AUDIT_ACTOR_TYPE.USER,
                actorId: userId,
                entityType: AUDIT_ENTITY_TYPE.BILL_PAYMENT,
                entityId: id,
                ipAddress,
                userAgent,
                metadata: { billPaymentId: id, productId, total, currency: product.currency },
            });
        });
    } catch (error) {
        if (isInsufficientBalanceError({ error })) return { data: null, failure: ACTION_FAILURE.INSUFFICIENT_BALANCE, verification, isNew: false };
        if (isIdempotencyConflictError({ error })) {
            const raced = await replay();
            if (raced) return raced;
        }
        throw error;
    }

    await submitBillPayment({
        billPaymentId: id,
        provider: product.provider,
        providerProductRef: product.providerProductRef,
        customerId,
        amount: { amount: chargeAmount, currency: product.currency },
    });

    const { data } = await fetchBillPayment({ userId, billPaymentId: id, refresh: false });
    return { data, failure: null, verification, isNew: true };
};

export default createBillPayment;
