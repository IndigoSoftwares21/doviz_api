import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchWalletTransactions from "@/actions/walletTransactions/fetchWalletTransactions";
import getWalletTransactionsSchema from "./schema/getWalletTransactionsSchema";

const getWalletTransactions = async (req: Request, res: Response) => {
    try {
        const { cursor, size } = req.query;
        const { id: userId } = req.user!;

        const validated = await getWalletTransactionsSchema.parseAsync({ cursor, size });

        const { data } = await fetchWalletTransactions({ userId, afterEntryId: validated.cursor, size: validated.size });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Transactions fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch transactions", error });
    }
};

export default getWalletTransactions;
