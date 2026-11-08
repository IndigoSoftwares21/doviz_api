import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createEmailVerification from "@/actions/emailVerification/createEmailVerification";
import postEmailVerificationSchema from "./schema/postEmailVerificationSchema";

const postEmailVerification = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const { id: userId } = req.user!;

        const validated = await postEmailVerificationSchema.parseAsync({ userId, email });

        const { data } = await createEmailVerification({
            userId,
            email: validated.email,
            requestIp: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        return handleSuccess({
            res,
            req,
            message: "Verification code sent to your email",
            code: 201,
            data,
        });
    } catch (error) {
        return handleError({
            res,
            req,
            message: "Failed to send email verification code",
            error,
        });
    }
};

export default postEmailVerification;
