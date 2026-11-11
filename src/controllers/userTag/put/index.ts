import { Request, Response } from "express";
import { ZodError } from "zod";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import modifyUserTag from "@/actions/userTag/modifyUserTag";
import putUserTagSchema from "./schema/putUserTagSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import { ZIKTAG_FAILURE, ZIKTAG_MESSAGES } from "@/constants/ziktags";

const fieldError = (path: string, message: string) => new ZodError([{ code: "custom", path: [path], message }]);
const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// Reads only `tag` and `pin` from the body — the PIN is never logged or echoed.
const putUserTag = async (req: Request, res: Response) => {
    try {
        const { tag, pin } = req.body;
        const { id: userId } = req.user!;

        const validated = await putUserTagSchema.parseAsync({ userId, tag, pin });

        const { data, failure, ...result } = await modifyUserTag({
            userId,
            value: validated.tag,
            pin: validated.pin ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        const verification = "verification" in result ? result.verification : undefined;
        if (failure === ZIKTAG_FAILURE.PIN && verification && verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) {
            return handlePinFailure({ res, req, verification });
        }
        if (failure === ZIKTAG_FAILURE.PIN_REQUIRED) return handleError({ res, req, error: fieldError("pin", ZIKTAG_MESSAGES.PIN_REQUIRED) });
        // Backstop: the schema already refused these; a race the database caught gets the SAME shape.
        if (failure === ZIKTAG_FAILURE.INVALID) return handleError({ res, req, error: fieldError("tag", ZIKTAG_MESSAGES.INVALID) });
        if (failure === ZIKTAG_FAILURE.RESERVED) return handleError({ res, req, error: fieldError("tag", ZIKTAG_MESSAGES.RESERVED) });
        if (failure === ZIKTAG_FAILURE.TAKEN) return handleError({ res, req, error: fieldError("tag", ZIKTAG_MESSAGES.TAKEN) });
        if (failure === ZIKTAG_FAILURE.COOLDOWN && "nextChangeAt" in result && result.nextChangeAt) {
            return handleError({ res, req, error: fieldError("tag", `You can change your Ziktag again on ${day(result.nextChangeAt)}`) });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Ziktag saved", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to save Ziktag", error });
    }
};

export default putUserTag;
