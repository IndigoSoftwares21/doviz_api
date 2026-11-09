import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchIncomingDeposits from "@/actions/walletIncoming/fetchIncomingDeposits";

const getWalletIncoming = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchIncomingDeposits({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Incoming deposits fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch incoming deposits", error });
    }
};

export default getWalletIncoming;
