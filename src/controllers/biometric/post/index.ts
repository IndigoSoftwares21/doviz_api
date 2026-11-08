import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createBiometric from "@/actions/biometric/createBiometric";
import postBiometricSchema from "./schema/postBiometricSchema";

const postBiometric = async (req: Request, res: Response) => {
    try {
        const { deviceName, publicKey, pin } = req.body;
        const { id: userId, deviceId } = req.user!;

        const validated = await postBiometricSchema.parseAsync({ userId, deviceName, publicKey, pin });

        const { data, verification } = await createBiometric({
            userId,
            deviceId,
            deviceName: validated.deviceName || null,
            publicKey: validated.publicKey,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification.status !== "verified") {
            return handlePinFailure({ res, req, verification });
        }

        return handleSuccess({ res, req, message: "Biometrics turned on", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to turn on biometrics", error });
    }
};

export default postBiometric;
