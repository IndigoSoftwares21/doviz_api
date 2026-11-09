import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import postPinVerificationSchema from "./schema/postPinVerificationSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";

const postPinVerification = async (req: Request, res: Response) => {
    try {
        const { pin } = req.body;
        const { id: userId } = req.user!;

        const validated = await postPinVerificationSchema.parseAsync({ pin });

        const { data } = await createPinVerification({
            userId,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (data.status !== PIN_VERIFICATION_STATUS.VERIFIED) {
            return handlePinFailure({ res, req, verification: data });
        }

        return handleSuccess({ res, req, message: "PIN verified", code: 200, data: { verified: true } });
    } catch (error) {
        return handleError({ res, req, message: "Failed to verify PIN", error });
    }
};

export default postPinVerification;
