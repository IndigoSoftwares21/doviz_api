import { Request, Response } from "express";
import handleError from "@/utils/handleError";
import { PinVerification } from "@/actions/pinVerification/createPinVerification";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";

// Maps a failed PinVerification to the standard error response.
const handlePinFailure = ({
    res,
    req,
    verification,
}: {
    res: Response;
    req: Request;
    verification: Exclude<PinVerification, { status: typeof PIN_VERIFICATION_STATUS.VERIFIED }>;
}) => {
    if (verification.status === PIN_VERIFICATION_STATUS.NOT_SET) {
        return handleError({ res, req, message: "Set a transfer PIN first", code: 400 });
    }

    if (verification.status === PIN_VERIFICATION_STATUS.LOCKED) {
        return handleError({
            res,
            req,
            message: `Too many incorrect attempts. Your PIN is locked until ${verification.lockedUntil.toISOString()}. Reset your PIN to unlock it now.`,
            code: 423,
        });
    }

    return handleError({
        res,
        req,
        message: `Incorrect PIN. ${verification.remainingAttempts} attempt${verification.remainingAttempts === 1 ? "" : "s"} remaining.`,
        code: 400,
    });
};

export default handlePinFailure;
