import { Request, Response } from "express";
import renderDocsPage from "@/docs/renderDocsPage";

const getDocs = (_req: Request, res: Response) => {
    return res.type("html").send(renderDocsPage({ nonce: res.locals.cspNonce }));
};

export default getDocs;
