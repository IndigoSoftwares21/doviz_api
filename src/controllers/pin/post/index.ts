import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createPin from "@/actions/pin/createPin";
import postPinSchema from "./schema/postPinSchema";

const postPin = async (req: Request, res: Response) => {
    try {
        const { pin, confirmPin } = req.body;
        const { id: userId } = req.user!;

        const validated = await postPinSchema.parseAsync({ userId, pin, confirmPin });

        const { data } = await createPin({
            userId,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        return handleSuccess({ res, req, message: "Transfer PIN set", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to set transfer PIN", error });
    }
};

export default postPin;
