import { Request, Response } from "express";
import DOCS from "@/constants/docs";
import renderDocsLoginPage from "@/docs/renderDocsLoginPage";
import getDocsConfig from "@/utils/docs/getDocsConfig";
import signDocsSession from "@/utils/docs/signDocsSession";
import verifyDocsPassword from "@/utils/docs/verifyDocsPassword";
import monitoring from "@/utils/monitoring";

const postDocsLogin = (req: Request, res: Response) => {
    const { password } = req.body ?? {};
    // requireDocsEnabled guarantees config is present on this route.
    const config = getDocsConfig()!;

    if (!verifyDocsPassword({ candidate: password, password: config.password, secret: config.secret })) {
        monitoring.info("Docs login failed", { ip: req.ip });

        return res
            .status(401)
            .type("html")
            .send(
                renderDocsLoginPage({
                    nonce: res.locals.cspNonce,
                    error: "Incorrect password.",
                }),
            );
    }

    const expiresAt = Date.now() + DOCS.SESSION_TTL_SECONDS * 1000;

    res.cookie(
        DOCS.COOKIE_NAME,
        signDocsSession({ secret: config.secret, password: config.password, expiresAt }),
        {
            path: DOCS.COOKIE_PATH,
            maxAge: DOCS.SESSION_TTL_SECONDS * 1000,
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
        },
    );

    monitoring.info("Docs login succeeded", { ip: req.ip });

    return res.redirect(303, "/docs");
};

export default postDocsLogin;
