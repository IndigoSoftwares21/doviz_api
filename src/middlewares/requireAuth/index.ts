import { NextFunction, Request, Response } from "express";
import "@/types/express";
import handleError from "@/utils/handleError";
import USER from "@/constants/user";
import verifyAccessToken from "@/utils/auth/verifyAccessToken";
import selectActiveSession from "./queries/selectActiveSession";

// Verifies the bearer JWT, then checks its session is still live in the DB
// on every request, so revoking a session takes effect immediately rather
// than when the access token expires.
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authorization = req.get("authorization");
        const token = authorization?.startsWith("Bearer ")
            ? authorization.slice("Bearer ".length).trim()
            : null;

        if (!token) {
            return handleError({ res, req, message: "Authentication required", code: 401 });
        }

        const { userId, sessionId } = verifyAccessToken({ token });

        const session = await selectActiveSession({ sessionId, userId, now: new Date() });

        if (!session) {
            return handleError({ res, req, message: "Authentication required", code: 401 });
        }

        // Suspended/closed accounts keep their sessions (so support can lift a
        // suspension) but can't use them.
        if (session.accountStatus !== USER.STATUS_ACTIVE) {
            return handleError({
                res,
                req,
                message: "Your account is not active. Please contact support.",
                code: 403,
            });
        }

        req.user = { id: userId, sessionId, deviceId: session.deviceId };

        return next();
    } catch (error) {
        return handleError({
            res,
            req,
            message: "Authentication required",
            code: 401,
            error,
        });
    }
};

export default requireAuth;
