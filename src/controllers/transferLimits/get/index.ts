import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchTransferLimits from "@/actions/transferLimits/fetchTransferLimits";

const getTransferLimits = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchTransferLimits({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Transfer limits fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch transfer limits", error });
    }
};

export default getTransferLimits;
