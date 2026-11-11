import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createNairaDepositCancellation from "@/actions/nairaDepositCancellation/createNairaDepositCancellation";
import getNairaDepositSchema from "@/controllers/nairaDeposit/get/schema/getNairaDepositSchema";

const postNairaDepositCancellation = async (req: Request, res: Response) => {
    try {
        const { nairaDepositId } = req.params;
        const { id: userId } = req.user!;

        const validated = await getNairaDepositSchema.parseAsync({ nairaDepositId });

        const { data } = await createNairaDepositCancellation({ userId, nairaDepositId: validated.nairaDepositId });
        if (!data) return handleError({ res, req, message: "Deposit not found", code: 404 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Deposit cancelled", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to cancel deposit", error });
    }
};

export default postNairaDepositCancellation;
