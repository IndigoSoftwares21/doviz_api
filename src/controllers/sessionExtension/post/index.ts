import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createSessionExtension from "@/actions/sessionExtension/createSessionExtension";

const postSessionExtension = async (req: Request, res: Response) => {
    try {
        const { id: userId, sessionId } = req.user!;

        const { data } = createSessionExtension({ userId, sessionId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Session extended", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to extend session", error });
    }
};

export default postSessionExtension;
