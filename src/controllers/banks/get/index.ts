import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBanks from "@/actions/banks/fetchBanks";

const getBanks = async (req: Request, res: Response) => {
    try {
        const { data } = await fetchBanks();

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Banks fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch banks", error });
    }
};

export default getBanks;
