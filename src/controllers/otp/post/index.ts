import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createOtp from "@/actions/otp/createOtp";
import AUTH from "@/constants/auth";
import postOtpSchema from "./schema/postOtpSchema";

const postOtp = async (req: Request, res: Response) => {
    try {
        const { phoneNumber } = req.body;

        const validated = await postOtpSchema.parseAsync({ phoneNumber });

        const { data } = await createOtp({
            phoneNumber: validated.phoneNumber,
            purpose: AUTH.OTP_PURPOSE_LOGIN,
            requestIp: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        return handleSuccess({
            res,
            req,
            message: "Verification code sent",
            code: 201,
            data,
        });
    } catch (error) {
        return handleError({
            res,
            req,
            message: "Failed to send verification code",
            error,
        });
    }
};

export default postOtp;
