import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createLogin from "@/actions/login/createLogin";
import postLoginSchema from "./schema/postLoginSchema";

const postLogin = async (req: Request, res: Response) => {
    try {
        const { phoneNumber, otp, deviceId, deviceName, platform } = req.body;

        const validated = await postLoginSchema.parseAsync({ phoneNumber, otp, deviceId, deviceName, platform });

        const { data } = await createLogin({
            phoneNumber: validated.phoneNumber,
            otp: validated.otp,
            deviceId: validated.deviceId,
            deviceName: validated.deviceName || null,
            platform: validated.platform ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (!data) {
            return handleError({
                res,
                req,
                message: "Invalid or expired verification code",
                code: 401,
            });
        }

        // Tokens must never be cached by proxies or the client.
        res.set("Cache-Control", "no-store");

        return handleSuccess({
            res,
            req,
            message: "Login successful",
            code: 200,
            data,
        });
    } catch (error) {
        return handleError({
            res,
            req,
            message: "Failed to log in",
            error,
        });
    }
};

export default postLogin;
