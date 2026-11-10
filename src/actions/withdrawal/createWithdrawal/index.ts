import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import { withTransaction } from "@/database";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchWithdrawal from "@/actions/withdrawal/fetchWithdrawal";
import fetchWithdrawalQuote from "@/actions/withdrawalQuote/fetchWithdrawalQuote";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import isInsufficientBalanceError from "@/utils/ledger/isInsufficientBalanceError";
import monitoring from "@/utils/monitoring";
import selectWithdrawalIdByIdempotencyKey from "./queries/selectWithdrawalIdByIdempotencyKey";
import selectWithdrawalCustomer from "./queries/selectWithdrawalCustomer";
import insertWithdrawal from "./queries/insertWithdrawal";
import checkPayoutFloat from "./utils/checkPayoutFloat";
import submitWithdrawal from "./utils/submitWithdrawal";
import scheduleWithdrawalChecks from "./utils/scheduleWithdrawalChecks";
import isIdempotencyConflictError from "./utils/isIdempotencyConflictError";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import AUDIT_ACTIONS from "@/constants/auditActions";
import WITHDRAWALS from "@/constants/withdrawals";
import { REALTIME_EVENT } from "@/constants/realtime";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface ICreateWithdrawal {
    userId: string;
    bankAccountId: string;
    amount: string;
    /** The total the user confirmed (amount + fee shown). A different one now → they re-confirm. */
    expectedTotal: string;
    idempotencyKey: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Sends naira to one of the user's own bank accounts: PIN → re-quote with the
 * ACTIVE provider (fee/provider changed since they confirmed → quote_changed,
 * nothing held) → float check (skipped if the provider can't report one) →
 * hold amount + fee reserve and record the withdrawal, with its provider, in
 * one transaction (the ledger refuses an overdraft) → send (≤ SUBMIT_WAIT_MS,
 * then background) → return it. The same idempotency key returns the original.
 */
const createWithdrawal = async ({ userId, bankAccountId, amount, expectedTotal, idempotencyKey, pin, ipAddress, userAgent }: ICreateWithdrawal) => {
    const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return { data: null, failure: ACTION_FAILURE.PIN, verification, isNew: false, quote: null, limits: null };

    const replay = async () => {
        const existing = await selectWithdrawalIdByIdempotencyKey({ userId, idempotencyKey });
        if (!existing) return null;
        const { data } = await fetchWithdrawal({ userId, withdrawalId: existing.id });
        return { data, failure: null, verification, isNew: false, quote: null, limits: null };
    };
    const previous = await replay();
    if (previous) return previous;

    const { data: quote, failure, limits } = await fetchWithdrawalQuote({ userId, bankAccountId, amount });
    if (!quote) return { data: null, failure, verification, isNew: false, quote: null, limits };
    const summary = { amount: quote.amount, fee: quote.fee, feeIsExact: quote.feeIsExact, totalHeld: quote.totalHeld, currency: quote.currency };
    if (!new Decimal(expectedTotal).equals(quote.totalHeld)) {
        return { data: null, failure: ACTION_FAILURE.QUOTE_CHANGED, verification, isNew: false, quote: summary, limits: null };
    }

    const { provider } = quote;
    if (!(await checkPayoutFloat({ provider, needed: quote.totalHeld, currency: quote.currency }))) {
        return { data: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE, verification, isNew: false, quote: null, limits: null };
    }

    const customer = await selectWithdrawalCustomer({ userId });
    const id = randomUUID();

    try {
        await withTransaction(async (trx) => {
            const { data: hold } = await createLedgerPosting({
                trx,
                idempotencyKey: `withdrawal-hold:${id}`,
                type: LEDGER_TRANSACTION_TYPE.WITHDRAWAL_HOLD,
                description: `Withdrawal to ${quote.account.bankName}`.slice(0, 255),
                currency: quote.currency,
                metadata: { withdrawalId: id, provider: provider.name, bankAccountId, fee: quote.fee, feeIsExact: quote.feeIsExact },
                entries: [
                    { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: new Decimal(quote.totalHeld).negated().toFixed(2) },
                    { account: { kind: LEDGER_ACCOUNT_KIND.PAYOUTS_IN_TRANSIT, provider: provider.name }, amount: quote.totalHeld },
                ],
            });

            await insertWithdrawal({
                trx,
                id,
                userId,
                bankAccountId,
                provider: provider.name,
                environment: provider.environment,
                providerBankCode: quote.providerBankId,
                idempotencyKey,
                currency: quote.currency,
                amount: quote.amount,
                feeReserve: quote.fee,
                totalHeld: quote.totalHeld,
                holdLedgerTransactionId: hold.transactionId,
            });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.WITHDRAWAL_REQUESTED,
                actorType: AUDIT_ACTOR_TYPE.USER,
                actorId: userId,
                entityType: AUDIT_ENTITY_TYPE.BANK_WITHDRAWAL,
                entityId: id,
                ipAddress,
                userAgent,
                metadata: { withdrawalId: id, bankAccountId, amount: quote.amount, feeReserve: quote.fee, provider: provider.name },
            });

            await publishUserEvent({ trx, userId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });
        });
    } catch (error) {
        if (isInsufficientBalanceError({ error })) return { data: null, failure: ACTION_FAILURE.INSUFFICIENT_BALANCE, verification, isNew: false, quote: summary, limits: null };
        if (isIdempotencyConflictError({ error })) {
            const raced = await replay();
            if (raced) return raced;
        }
        throw error;
    }

    // submitWithdrawal handles every provider outcome; anything it throws is
    // logged and left to the reconciler (the money is held, never lost).
    const submission = submitWithdrawal({
        withdrawalId: id,
        provider: provider.name,
        providerBankId: quote.providerBankId,
        accountNumber: quote.account.accountNumber,
        accountName: quote.account.accountName,
        amount: quote.amount,
        customer: { name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || quote.account.accountName, email: customer.email },
    }).catch((error) => monitoring.error(`Withdrawal ${id}: submission failed — will reconcile`, error as Error));
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([submission, new Promise<void>((resolve) => (timer = setTimeout(resolve, WITHDRAWALS.SUBMIT_WAIT_MS)))]);
    clearTimeout(timer);

    const { data } = await fetchWithdrawal({ userId, withdrawalId: id });
    if (data && (data.status === "pending" || data.status === "processing")) scheduleWithdrawalChecks({ withdrawalId: id });
    return { data, failure: null, verification, isNew: true, quote: null, limits: null };
};

export default createWithdrawal;
