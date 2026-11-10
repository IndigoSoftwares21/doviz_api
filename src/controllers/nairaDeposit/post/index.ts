import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createNairaDeposit from "@/actions/nairaDeposit/createNairaDeposit";
import postNairaDepositSchema from "./schema/postNairaDepositSchema";
import ACTION_FAILURE from "@/constants/actionFailure";

export const DEPOSITS_UNAVAILABLE = "Bank transfer deposits are temporarily unavailable. Please try again shortly.";

const postNairaDeposit = async (req: Request, res: Response) => {
    try {
        const { amount, idempotencyKey } = req.body;
        const { id: userId } = req.user!;

        const validated = await postNairaDepositSchema.parseAsync({ amount, idempotencyKey });

        const { data, failure, isNew } = await createNairaDeposit({
            userId,
            amount: validated.amount,
            idempotencyKey: validated.idempotencyKey,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (failure === ACTION_FAILURE.PROVIDER_UNAVAILABLE) return handleError({ res, req, message: DEPOSITS_UNAVAILABLE, code: 503 });

        res.set("Cache-Control", "no-store");

        return isNew
            ? handleSuccess({ res, req, message: "Transfer details ready", code: 201, data })
            : handleSuccess({ res, req, message: "Deposit already started", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to start deposit", error });
    }
};

export default postNairaDeposit;
