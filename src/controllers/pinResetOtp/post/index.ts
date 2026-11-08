import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createPinResetOtp from "@/actions/pinResetOtp/createPinResetOtp";
import postPinResetOtpSchema from "./schema/postPinResetOtpSchema";

const postPinResetOtp = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        await postPinResetOtpSchema.parseAsync({ userId });

        const { data } = await createPinResetOtp({
            userId,
            requestIp: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        return handleSuccess({ res, req, message: "PIN reset code sent to your phone", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to send PIN reset code", error });
    }
};

export default postPinResetOtp;
