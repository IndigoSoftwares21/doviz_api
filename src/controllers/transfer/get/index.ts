import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchTransfer from "@/actions/transfer/fetchTransfer";
import getTransferSchema from "./schema/getTransferSchema";

const getTransfer = async (req: Request, res: Response) => {
    try {
        const { transferId } = req.params;
        const { id: viewerId } = req.user!;

        const validated = await getTransferSchema.parseAsync({ transferId });

        const { data } = await fetchTransfer({ transferId: validated.transferId, viewerId });
        if (!data) return handleError({ res, req, message: "Transfer not found", code: 404 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Transfer fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch transfer", error });
    }
};

export default getTransfer;
