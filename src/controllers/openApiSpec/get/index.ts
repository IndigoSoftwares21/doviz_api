import { Request, Response } from "express";
import openApiSpec from "@/docs/openapi";

const getOpenApiSpec = (_req: Request, res: Response) => {
    return res.json(openApiSpec);
};

export default getOpenApiSpec;
