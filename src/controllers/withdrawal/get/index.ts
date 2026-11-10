import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchWithdrawal from "@/actions/withdrawal/fetchWithdrawal";
import getWithdrawalSchema from "./schema/getWithdrawalSchema";

const getWithdrawal = async (req: Request, res: Response) => {
    try {
        const { withdrawalId } = req.params;
        const { id: userId } = req.user!;

        const validated = await getWithdrawalSchema.parseAsync({ withdrawalId });

        const { data } = await fetchWithdrawal({ userId, withdrawalId: validated.withdrawalId });
        if (!data) return handleError({ res, req, message: "Withdrawal not found", code: 404 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Withdrawal fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch withdrawal", error });
    }
};

export default getWithdrawal;
