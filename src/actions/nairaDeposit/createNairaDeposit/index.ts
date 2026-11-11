import { randomUUID } from "crypto";
import { withTransaction } from "@/database";
import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchNairaDeposit from "@/actions/nairaDeposit/fetchNairaDeposit";
import fetchActiveNairaDeposit from "@/actions/nairaDeposit/fetchActiveNairaDeposit";
import selectNairaDepositIdByIdempotencyKey from "./queries/selectNairaDepositIdByIdempotencyKey";
import selectDepositCustomer from "./queries/selectDepositCustomer";
import insertNairaDeposit from "./queries/insertNairaDeposit";
import { closePendingDeposits } from "@/actions/nairaDepositCancellation/createNairaDepositCancellation";
import issueBankTransfer from "./utils/issueBankTransfer";
import isNairaDepositIdempotencyConflict from "./utils/isNairaDepositIdempotencyConflict";
import ACTION_FAILURE from "@/constants/actionFailure";
import AUDIT_ACTIONS from "@/constants/auditActions";
import NAIRA_DEPOSITS from "@/constants/nairaDeposits";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import BRAND from "@/constants/brand";

interface ICreateNairaDeposit {
    userId: string;
    /** What the user wants to receive, e.g. "50000.00". */
    amount: string;
    idempotencyKey: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Starts a naira top-up: asks a provider for a one-time account for this
 * amount (the provider's fee added on top when the user bears it) and
 * records it. No money moves here — the user is credited only when the
 * provider confirms the transfer. Repeating a request with the same
 * idempotency key returns the original deposit; asking again for the same
 * amount while that account still has time left reuses it (one live account
 * per top-up, not one per tap). A different amount gets a new account and
 * closes the older unpaid one (it's still credited if paid).
 */
const createNairaDeposit = async ({ userId, amount, idempotencyKey, ipAddress, userAgent }: ICreateNairaDeposit) => {
    const replay = async () => {
        const existing = await selectNairaDepositIdByIdempotencyKey({ userId, idempotencyKey });
        if (!existing) return null;
        const { data } = await fetchNairaDeposit({ userId, nairaDepositId: existing.id });
        return { data, failure: null, isNew: false };
    };

    const previous = await replay();
    if (previous) return previous;

    const { data: active } = await fetchActiveNairaDeposit({ userId });
    if (active && active.amount === amount && active.expiresInSeconds * 1000 >= NAIRA_DEPOSITS.REUSE_MIN_REMAINING_MS) {
        return { data: active, failure: null, isNew: false };
    }

    const customer = await selectDepositCustomer({ userId });
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null;
    const feeBearer = collectionProviderRegistry.feeBearer();
    const id = randomUUID();

    const issued = await issueBankTransfer({
        externalId: id,
        amount: { amount, currency: NAIRA_DEPOSITS.CURRENCY },
        feeBearer,
        customer: { name, email: customer.email },
        narration: `${BRAND.NAME} wallet top-up`,
    });
    if (!issued) return { data: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE, isNew: false };

    const { provider, transfer } = issued;
    try {
        await withTransaction(async (trx) => {
            await insertNairaDeposit({
                trx,
                id,
                userId,
                provider,
                providerReference: transfer.providerReference,
                idempotencyKey,
                currency: NAIRA_DEPOSITS.CURRENCY,
                amount,
                feeBearer,
                fee: transfer.fee.amount,
                amountToTransfer: transfer.amountToTransfer.amount,
                accountName: transfer.bankAccount.accountName,
                accountNumber: transfer.bankAccount.accountNumber,
                bankName: transfer.bankAccount.bankName,
                expiresAt: transfer.expiresAt,
            });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.NAIRA_DEPOSIT_REQUESTED,
                actorType: AUDIT_ACTOR_TYPE.USER,
                actorId: userId,
                entityType: AUDIT_ENTITY_TYPE.NAIRA_DEPOSIT,
                entityId: id,
                ipAddress,
                userAgent,
                metadata: { nairaDepositId: id, amount, fee: transfer.fee.amount, feeBearer, provider },
            });

            // One top-up in progress: a new amount replaces any older unpaid one (still credited if paid).
            await closePendingDeposits({ trx, userId, exceptId: id, reason: "replaced_by_new_top_up" });
        });
    } catch (error) {
        if (isNairaDepositIdempotencyConflict({ error })) {
            const raced = await replay();
            if (raced) return raced;
        }
        throw error;
    }

    const { data } = await fetchNairaDeposit({ userId, nairaDepositId: id });
    return { data, failure: null, isNew: true };
};

export default createNairaDeposit;
