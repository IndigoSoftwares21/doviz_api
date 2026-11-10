import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchNairaDeposit from "@/actions/nairaDeposit/fetchNairaDeposit";
import getNairaDepositSchema from "./schema/getNairaDepositSchema";

const getNairaDeposit = async (req: Request, res: Response) => {
    try {
        const { nairaDepositId } = req.params;
        const { id: userId } = req.user!;

        const validated = await getNairaDepositSchema.parseAsync({ nairaDepositId });

        const { data } = await fetchNairaDeposit({ userId, nairaDepositId: validated.nairaDepositId });
        if (!data) return handleError({ res, req, message: "Deposit not found", code: 404 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Deposit fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch deposit", error });
    }
};

export default getNairaDeposit;
