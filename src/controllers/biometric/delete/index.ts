import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import removeBiometric from "@/actions/biometric/removeBiometric";
import deleteBiometricSchema from "./schema/deleteBiometricSchema";

const deleteBiometric = async (req: Request, res: Response) => {
    try {
        const { deviceId } = req.params;
        const { id: userId } = req.user!;

        const validated = await deleteBiometricSchema.parseAsync({ deviceId });

        const { data } = await removeBiometric({
            userId,
            deviceId: validated.deviceId,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        return handleSuccess({ res, req, message: "Biometrics turned off", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to turn off biometrics", error });
    }
};

export default deleteBiometric;
