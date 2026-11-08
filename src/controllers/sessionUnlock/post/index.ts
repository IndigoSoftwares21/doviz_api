import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createSessionUnlock from "@/actions/sessionUnlock/createSessionUnlock";
import postSessionUnlockSchema from "./schema/postSessionUnlockSchema";

const SMS_LOGIN_REQUIRED = "Your session has ended. Log in again with an SMS code.";

const postSessionUnlock = async (req: Request, res: Response) => {
    try {
        const { refreshToken, deviceId, pin, challengeId, signature } = req.body;

        const validated = await postSessionUnlockSchema.parseAsync({
            refreshToken,
            deviceId,
            pin,
            challengeId,
            signature,
        });

        const result = await createSessionUnlock({
            refreshToken: validated.refreshToken,
            deviceId: validated.deviceId,
            pin: validated.pin,
            challengeId: validated.challengeId,
            signature: validated.signature,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        // 401 always means "go to SMS login"; 400/423 mean "try again".
        if (result.failure === "invalid_session") {
            return handleError({ res, req, message: SMS_LOGIN_REQUIRED, code: 401 });
        }

        if (result.failure === "pin") {
            if (result.verification.status === "locked") {
                return handleError({
                    res,
                    req,
                    message: "Too many incorrect attempts. Log in again with an SMS code.",
                    code: 423,
                });
            }

            return handlePinFailure({ res, req, verification: result.verification });
        }

        if (result.failure === "biometric") {
            return handleError({
                res,
                req,
                message: "Biometric verification failed. Try again or use your PIN.",
                code: 400,
            });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Session unlocked", code: 200, data: result.data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to unlock session", error });
    }
};

export default postSessionUnlock;
