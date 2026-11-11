import { randomUUID } from "crypto";
import createPinVerification, { PinVerification } from "@/actions/pinVerification/createPinVerification";
import fetchTransfer from "@/actions/transfer/fetchTransfer";
import isInsufficientBalanceError from "@/utils/ledger/isInsufficientBalanceError";
import selectTransferIdByIdempotencyKey from "./queries/selectTransferIdByIdempotencyKey";
import completeTransfer from "./utils/completeTransfer";
import isIdempotencyConflictError from "./utils/isIdempotencyConflictError";
import flagTransferVelocity from "./utils/flagTransferVelocity";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";

interface ICreateTransfer {
    senderId: string;
    recipientId: string;
    amount: string;
    note: string | null;
    idempotencyKey: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

type Transfer = NonNullable<Awaited<ReturnType<typeof fetchTransfer>>["data"]>;

/**
 * Sends naira to another Ziks user, instantly and free: PIN → replay (the same
 * idempotency key returns the original) → completeTransfer (one transaction)
 * → the completed transfer. No pending state: it's done when this returns.
 */
const createTransfer = async ({ senderId, recipientId, amount, note, idempotencyKey, pin, ipAddress, userAgent }: ICreateTransfer) => {
    const { data: verification } = await createPinVerification({ userId: senderId, pin, ipAddress, userAgent });
    const result = (fields: { data?: Transfer | null; failure?: string; message?: string; isNew?: boolean }) => ({
        data: null as Transfer | null, failure: null as string | null, message: null as string | null, isNew: false,
        verification: verification as PinVerification, ...fields,
    });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return result({ failure: ACTION_FAILURE.PIN });

    const replay = async () => {
        const existing = await selectTransferIdByIdempotencyKey({ senderId, idempotencyKey });
        return existing ? result({ data: (await fetchTransfer({ transferId: existing.id, viewerId: senderId })).data }) : null;
    };
    const previous = await replay();
    if (previous) return previous;

    const id = randomUUID();
    try {
        const outcome = await completeTransfer({ id, senderId, recipientId, amount, note, idempotencyKey, ipAddress, userAgent });
        if (outcome.failure) return result({ failure: outcome.failure, message: "message" in outcome ? outcome.message : undefined });
    } catch (error) {
        if (isInsufficientBalanceError({ error })) return result({ failure: ACTION_FAILURE.INSUFFICIENT_BALANCE });
        const raced = isIdempotencyConflictError({ error }) ? await replay() : null;
        if (raced) return raced;
        throw error;
    }

    await flagTransferVelocity({ senderId });
    const { data } = await fetchTransfer({ transferId: id, viewerId: senderId });
    return result({ data, isNew: true });
};

export default createTransfer;
