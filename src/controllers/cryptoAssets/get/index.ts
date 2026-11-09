import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchCryptoAssets from "@/actions/cryptoAssets/fetchCryptoAssets";

const getCryptoAssets = async (req: Request, res: Response) => {
    try {
        const { data } = await fetchCryptoAssets();

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Assets fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch assets", error });
    }
};

export default getCryptoAssets;
