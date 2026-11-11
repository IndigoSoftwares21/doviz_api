import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchCryptoBuyAssets from "@/actions/cryptoBuyAssets/fetchCryptoBuyAssets";

const getCryptoBuyAssets = async (req: Request, res: Response) => {
    try {
        const { data } = await fetchCryptoBuyAssets();

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Coins you can buy", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch coins", error });
    }
};

export default getCryptoBuyAssets;
