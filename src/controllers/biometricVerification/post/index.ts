import { Request, Response } from "express";
import AUTH from "@/constants/auth";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createBiometricVerification from "@/actions/biometricVerification/createBiometricVerification";
import postBiometricVerificationSchema from "./schema/postBiometricVerificationSchema";

const postBiometricVerification = async (req: Request, res: Response) => {
    try {
        const { challengeId, signature } = req.body;
        const { id: userId, deviceId } = req.user!;

        const validated = await postBiometricVerificationSchema.parseAsync({ challengeId, signature });

        const { data } = await createBiometricVerification({
            userId,
            challengeId: validated.challengeId,
            signature: validated.signature,
            purpose: AUTH.BIOMETRIC_PURPOSE_VERIFICATION,
            deviceId,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (!data) {
            return handleError({
                res,
                req,
                message: "Biometric verification failed. Request a new challenge or use your PIN.",
                code: 400,
            });
        }

        return handleSuccess({ res, req, message: "Biometric verified", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to verify biometric", error });
    }
};

export default postBiometricVerification;
