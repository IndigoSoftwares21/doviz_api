import { NextFunction, Request, Response } from "express";
import DOCS from "@/constants/docs";
import getDocsConfig from "@/utils/docs/getDocsConfig";
import getCookie from "@/utils/docs/getCookie";
import verifyDocsSession from "@/utils/docs/verifyDocsSession";

const protectDocs = (req: Request, res: Response, next: NextFunction) => {
    const config = getDocsConfig();

    const isAuthenticated =
        !!config &&
        verifyDocsSession({
            token: getCookie({ req, name: DOCS.COOKIE_NAME }),
            secret: config.secret,
            password: config.password,
        });

    if (isAuthenticated) {
        return next();
    }

    if (req.path === "/openapi.json") {
        return res.status(401).json({ message: "Authentication required", code: 401 });
    }

    return res.redirect(303, "/docs/login");
};

export default protectDocs;
