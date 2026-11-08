import { Request, Response } from "express";
import AUTH from "@/constants/auth";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createBiometricChallenge from "@/actions/biometricChallenge/createBiometricChallenge";

// Challenge for approving an action on this session's own device.
const postBiometricChallenge = async (req: Request, res: Response) => {
    try {
        const { id: userId, deviceId } = req.user!;

        const { data } = await createBiometricChallenge({
            userId,
            deviceId,
            purpose: AUTH.BIOMETRIC_PURPOSE_VERIFICATION,
        });

        if (!data) {
            return handleError({ res, req, message: "Biometrics are not turned on for this device", code: 400 });
        }

        return handleSuccess({ res, req, message: "Biometric challenge created", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to create biometric challenge", error });
    }
};

export default postBiometricChallenge;
