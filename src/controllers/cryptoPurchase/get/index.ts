import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchCryptoPurchase from "@/actions/cryptoPurchase/fetchCryptoPurchase";
import getCryptoPurchaseSchema from "./schema/getCryptoPurchaseSchema";

const getCryptoPurchase = async (req: Request, res: Response) => {
    try {
        const { purchaseId } = req.params;
        const { id: userId } = req.user!;

        const validated = await getCryptoPurchaseSchema.parseAsync({ purchaseId });

        const { data } = await fetchCryptoPurchase({ userId, purchaseId: validated.purchaseId });
        if (!data) return handleError({ res, req, message: "Purchase not found", code: 404 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Crypto purchase fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch purchase", error });
    }
};

export default getCryptoPurchase;
