import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createBankAccount from "@/actions/bankAccount/createBankAccount";
import fetchActivePayoutProvider from "@/actions/payoutProvider/fetchActivePayoutProvider";
import { BANK_LOOKUP_FAILED } from "@/controllers/bankResolution/post";
import postBankAccountSchema from "./schema/postBankAccountSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";

const postBankAccount = async (req: Request, res: Response) => {
    try {
        const { bankId, accountNumber, pin } = req.body;
        const { id: userId } = req.user!;
        const { data: provider } = await fetchActivePayoutProvider();

        const validated = await postBankAccountSchema.parseAsync({
            userId,
            provider: provider.name,
            environment: provider.environment,
            bankId,
            accountNumber,
            pin,
        });

        const { data, failure, verification } = await createBankAccount({
            userId,
            bankId: validated.bankId,
            accountNumber: validated.accountNumber,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return handlePinFailure({ res, req, verification });
        if (failure === ACTION_FAILURE.RESOLVE_FAILED) return handleError({ res, req, message: BANK_LOOKUP_FAILED, code: 400 });
        if (failure === ACTION_FAILURE.NAME_MISMATCH) {
            return handleError({ res, req, message: "This account isn't in your name", code: 400 });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Bank account added", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to add bank account", error });
    }
};

export default postBankAccount;
