import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import modifyPin from "@/actions/pin/modifyPin";
import putPinSchema from "./schema/putPinSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";

const putPin = async (req: Request, res: Response) => {
    try {
        const { currentPin, newPin, confirmPin } = req.body;
        const { id: userId } = req.user!;

        const validated = await putPinSchema.parseAsync({ currentPin, newPin, confirmPin });

        const { data, verification } = await modifyPin({
            userId,
            currentPin: validated.currentPin,
            newPin: validated.newPin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) {
            return handlePinFailure({ res, req, verification });
        }

        return handleSuccess({ res, req, message: "Transfer PIN changed", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to change transfer PIN", error });
    }
};

export default putPin;
