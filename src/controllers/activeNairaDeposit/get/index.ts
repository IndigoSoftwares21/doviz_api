import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchActiveNairaDeposit from "@/actions/nairaDeposit/fetchActiveNairaDeposit";

const getActiveNairaDeposit = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchActiveNairaDeposit({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: data ? "Active deposit fetched" : "No active deposit", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch active deposit", error });
    }
};

export default getActiveNairaDeposit;
