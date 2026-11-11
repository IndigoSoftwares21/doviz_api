import { Request, Response } from "express";
import { ZodError } from "zod";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createTransfer from "@/actions/transfer/createTransfer";
import postTransferSchema from "./schema/postTransferSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import { TRANSFER_MESSAGES } from "@/constants/transfers";

const amountError = (message: string) => new ZodError([{ code: "custom", path: ["amount"], message }]);

// Reads only the fields it needs — the PIN is never logged or echoed.
const postTransfer = async (req: Request, res: Response) => {
    try {
        const { recipientId, amount, note, idempotencyKey, pin } = req.body;
        const { id: userId } = req.user!;

        const validated = await postTransferSchema.parseAsync({ userId, recipientId, amount, note, idempotencyKey, pin });

        const { data, failure, message, verification, isNew } = await createTransfer({
            senderId: userId,
            recipientId: validated.recipientId,
            amount: validated.amount,
            note: validated.note ?? null,
            idempotencyKey: validated.idempotencyKey,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return handlePinFailure({ res, req, verification });
        if (failure === ACTION_FAILURE.TRANSFER_LIMIT && message) return handleError({ res, req, error: amountError(message) });
        if (failure === ACTION_FAILURE.INSUFFICIENT_BALANCE) return handleError({ res, req, message: TRANSFER_MESSAGES.INSUFFICIENT_BALANCE, code: 402 });
        if (failure === ACTION_FAILURE.RECIPIENT_UNAVAILABLE) return handleError({ res, req, message: TRANSFER_MESSAGES.RECIPIENT_NOT_FOUND, code: 404 });
        if (failure === ACTION_FAILURE.ACCOUNT_INACTIVE) return handleError({ res, req, message: TRANSFER_MESSAGES.ACCOUNT_INACTIVE, code: 403 });
        if (!data) return handleError({ res, req, message: "Failed to send money" });

        res.set("Cache-Control", "no-store");

        return isNew
            ? handleSuccess({ res, req, message: "Money sent", code: 201, data })
            : handleSuccess({ res, req, message: "Money already sent", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to send money", error });
    }
};

export default postTransfer;
