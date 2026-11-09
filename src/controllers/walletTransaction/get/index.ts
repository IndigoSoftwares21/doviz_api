import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchWalletTransaction from "@/actions/walletTransaction/fetchWalletTransaction";
import getWalletTransactionSchema from "./schema/getWalletTransactionSchema";

const getWalletTransaction = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { id: userId } = req.user!;

        const validated = await getWalletTransactionSchema.parseAsync({ userId, entryId: id });

        const { data } = await fetchWalletTransaction({ userId, entryId: validated.entryId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Transaction fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch transaction", error });
    }
};

export default getWalletTransaction;
