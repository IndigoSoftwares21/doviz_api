import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBillers from "@/actions/billers/fetchBillers";
import getBillersSchema from "./schema/getBillersSchema";

const getBillers = async (req: Request, res: Response) => {
    try {
        const { category } = req.query;

        const validated = await getBillersSchema.parseAsync({ category });

        const { data } = await fetchBillers({ category: validated.category });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Billers fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch billers", error });
    }
};

export default getBillers;
