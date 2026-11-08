import { Request, Response } from "express";
import DOCS from "@/constants/docs";

const getDocsLogout = (_req: Request, res: Response) => {
    res.clearCookie(DOCS.COOKIE_NAME, {
        path: DOCS.COOKIE_PATH,
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
    });

    return res.redirect(303, "/docs/login");
};

export default getDocsLogout;
