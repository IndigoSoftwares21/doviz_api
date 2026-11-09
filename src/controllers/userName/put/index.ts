import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import modifyUserName from "@/actions/userName/modifyUserName";
import putUserNameSchema from "./schema/putUserNameSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";

const putUserName = async (req: Request, res: Response) => {
    try {
        const { firstName, middleName, lastName, pin } = req.body;
        const { id: userId } = req.user!;

        const validated = await putUserNameSchema.parseAsync({ userId, firstName, middleName, lastName, pin });

        const { data, verification } = await modifyUserName({
            userId,
            firstName: validated.firstName,
            middleName: validated.middleName ?? null,
            lastName: validated.lastName,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification && verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) {
            return handlePinFailure({ res, req, verification });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Name saved", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to save name", error });
    }
};

export default putUserName;
