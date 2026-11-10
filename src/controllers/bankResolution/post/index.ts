import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createBankResolution from "@/actions/bankResolution/createBankResolution";
import fetchActivePayoutProvider from "@/actions/payoutProvider/fetchActivePayoutProvider";
import postBankResolutionSchema from "./schema/postBankResolutionSchema";
import ACTION_FAILURE from "@/constants/actionFailure";

export const BANK_LOOKUP_FAILED = "We couldn't verify this account. Check the details and try again.";

const postBankResolution = async (req: Request, res: Response) => {
    try {
        const { bankId, accountNumber } = req.body;
        const { id: userId } = req.user!;
        const { data: provider } = await fetchActivePayoutProvider();

        const validated = await postBankResolutionSchema.parseAsync({
            userId,
            provider: provider.name,
            environment: provider.environment,
            bankId,
            accountNumber,
        });

        const { data, failure } = await createBankResolution({
            userId,
            bankId: validated.bankId,
            accountNumber: validated.accountNumber,
        });

        if (failure === ACTION_FAILURE.RESOLVE_FAILED) {
            return handleError({ res, req, message: BANK_LOOKUP_FAILED, code: 400 });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Account found", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to verify account", error });
    }
};

export default postBankResolution;
