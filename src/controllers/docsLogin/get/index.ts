import { Request, Response } from "express";
import DOCS from "@/constants/docs";
import renderDocsLoginPage from "@/docs/renderDocsLoginPage";
import getDocsConfig from "@/utils/docs/getDocsConfig";
import getCookie from "@/utils/docs/getCookie";
import verifyDocsSession from "@/utils/docs/verifyDocsSession";

const getDocsLogin = (req: Request, res: Response) => {
    const config = getDocsConfig();

    if (
        config &&
        verifyDocsSession({
            token: getCookie({ req, name: DOCS.COOKIE_NAME }),
            secret: config.secret,
            password: config.password,
        })
    ) {
        return res.redirect(303, "/docs");
    }

    return res.type("html").send(renderDocsLoginPage({ nonce: res.locals.cspNonce }));
};

export default getDocsLogin;
