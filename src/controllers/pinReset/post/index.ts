import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createPinReset from "@/actions/pinReset/createPinReset";
import postPinResetSchema from "./schema/postPinResetSchema";

const postPinReset = async (req: Request, res: Response) => {
    try {
        const { otp, newPin, confirmPin } = req.body;
        const { id: userId } = req.user!;

        const validated = await postPinResetSchema.parseAsync({ otp, newPin, confirmPin });

        const { data } = await createPinReset({
            userId,
            otp: validated.otp,
            newPin: validated.newPin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (!data) {
            return handleError({ res, req, message: "Invalid or expired verification code", code: 400 });
        }

        return handleSuccess({ res, req, message: "Transfer PIN reset", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to reset transfer PIN", error });
    }
};

export default postPinReset;
