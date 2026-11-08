import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import removeSession from "@/actions/session/removeSession";

const postLogout = async (req: Request, res: Response) => {
    try {
        const { id: userId, sessionId, deviceId } = req.user!;

        const { data } = await removeSession({
            userId,
            sessionId,
            deviceId,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        return handleSuccess({ res, req, message: "Logged out", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to log out", error });
    }
};

export default postLogout;
