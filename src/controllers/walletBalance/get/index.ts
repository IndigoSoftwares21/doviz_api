import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchWalletBalance from "@/actions/walletBalance/fetchWalletBalance";

const getWalletBalance = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchWalletBalance({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Balance fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch balance", error });
    }
};

export default getWalletBalance;
