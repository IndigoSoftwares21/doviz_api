import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBankAccounts from "@/actions/bankAccounts/fetchBankAccounts";

const getBankAccounts = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchBankAccounts({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Bank accounts fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch bank accounts", error });
    }
};

export default getBankAccounts;
