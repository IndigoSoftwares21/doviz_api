import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchCryptoWallets from "@/actions/cryptoWallets/fetchCryptoWallets";

const getCryptoWallets = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchCryptoWallets({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Deposit addresses fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch deposit addresses", error });
    }
};

export default getCryptoWallets;
