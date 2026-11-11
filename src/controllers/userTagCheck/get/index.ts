import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchTagAvailability from "@/actions/userTag/fetchTagAvailability";
import getTagCheckSchema from "./schema/getTagCheckSchema";

const getTagCheck = async (req: Request, res: Response) => {
    try {
        const { tag } = req.query;
        const { id: userId } = req.user!;

        const validated = await getTagCheckSchema.parseAsync({ tag });

        const { data } = await fetchTagAvailability({ userId, value: validated.tag });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Ziktag checked", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to check Ziktag", error });
    }
};

export default getTagCheck;
