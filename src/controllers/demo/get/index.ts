import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchDemo from "@/actions/demo/fetchDemo";
import getDemoSchema from "./schema/getDemoSchema";

const getDemo = async (req: Request, res: Response) => {
    try {
        const { limit } = req.query;

        const validated = await getDemoSchema.parseAsync({ limit });

        const { data } = await fetchDemo({ limit: validated.limit });

        return handleSuccess({
            res,
            req,
            message: "Demo records fetched successfully",
            code: 200,
            data,
        });
    } catch (error) {
        return handleError({
            res,
            req,
            message: "Failed to fetch demo records",
            error,
        });
    }
};

export default getDemo;
