import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createDemo from "@/actions/demo/createDemo";
import postDemoSchema from "./schema/postDemoSchema";

const postDemo = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;

        const validated = await postDemoSchema.parseAsync({ name });

        const { data } = await createDemo({ name: validated.name });

        return handleSuccess({
            res,
            req,
            message: "Demo record created successfully",
            code: 201,
            data,
        });
    } catch (error) {
        return handleError({
            res,
            req,
            message: "Failed to create demo record",
            error,
        });
    }
};

export default postDemo;
