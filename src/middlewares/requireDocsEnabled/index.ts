import { NextFunction, Request, Response } from "express";
import getDocsConfig from "@/utils/docs/getDocsConfig";

// Docs don't exist (404) unless DOCS_PASSWORD and DOCS_SESSION_SECRET are set.
const requireDocsEnabled = (_req: Request, res: Response, next: NextFunction) => {
    if (!getDocsConfig()) {
        return res.status(404).json({ message: "Not found", code: 404 });
    }

    return next();
};

export default requireDocsEnabled;
