import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createEmailConfirmation from "@/actions/emailConfirmation/createEmailConfirmation";
import postEmailConfirmationSchema from "./schema/postEmailConfirmationSchema";

const postEmailConfirmation = async (req: Request, res: Response) => {
    try {
        const { otp } = req.body;
        const { id: userId } = req.user!;

        const validated = await postEmailConfirmationSchema.parseAsync({ otp });

        const { data } = await createEmailConfirmation({
            userId,
            otp: validated.otp,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        // 400 rather than 401: the user IS authenticated — a 401 would make
        // the app think the session ended.
        if (!data) {
            return handleError({
                res,
                req,
                message: "Invalid or expired verification code",
                code: 400,
            });
        }

        return handleSuccess({
            res,
            req,
            message: "Email verified",
            code: 200,
            data,
        });
    } catch (error) {
        return handleError({
            res,
            req,
            message: "Failed to verify email",
            error,
        });
    }
};

export default postEmailConfirmation;
