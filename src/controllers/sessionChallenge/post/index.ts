import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createSessionChallenge from "@/actions/sessionChallenge/createSessionChallenge";
import postSessionChallengeSchema from "./schema/postSessionChallengeSchema";
import ACTION_FAILURE from "@/constants/actionFailure";

const postSessionChallenge = async (req: Request, res: Response) => {
    try {
        const { refreshToken, deviceId } = req.body;

        const validated = await postSessionChallengeSchema.parseAsync({ refreshToken, deviceId });

        const { data, failure } = await createSessionChallenge({
            refreshToken: validated.refreshToken,
            deviceId: validated.deviceId,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (failure === ACTION_FAILURE.INVALID_SESSION) {
            return handleError({
                res,
                req,
                message: "Your session has ended. Log in again with an SMS code.",
                code: 401,
            });
        }

        if (failure === ACTION_FAILURE.BIOMETRICS_OFF) {
            return handleError({ res, req, message: "Biometrics are not turned on for this device", code: 400 });
        }

        return handleSuccess({ res, req, message: "Biometric challenge created", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to create biometric challenge", error });
    }
};

export default postSessionChallenge;
