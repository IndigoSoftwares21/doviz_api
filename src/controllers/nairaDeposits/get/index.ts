import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchNairaDeposits from "@/actions/nairaDeposits/fetchNairaDeposits";
import getNairaDepositsSchema from "./schema/getNairaDepositsSchema";

const getNairaDeposits = async (req: Request, res: Response) => {
    try {
        const { limit, offset } = req.query;
        const { id: userId } = req.user!;

        const validated = await getNairaDepositsSchema.parseAsync({ limit, offset });

        const { data } = await fetchNairaDeposits({ userId, limit: validated.limit, offset: validated.offset });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Deposits fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch deposits", error });
    }
};

export default getNairaDeposits;
