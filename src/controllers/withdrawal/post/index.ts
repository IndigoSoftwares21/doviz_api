import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createWithdrawal from "@/actions/withdrawal/createWithdrawal";
import { BANK_UNSUPPORTED } from "@/controllers/withdrawalQuote/get";
import postWithdrawalSchema from "./schema/postWithdrawalSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import describeLimits from "@/utils/withdrawals/describeLimits";

export const QUOTE_CHANGED = "The transfer fee changed. Please check the new total and confirm again.";
export const WITHDRAWAL_INSUFFICIENT_BALANCE = "You don't have enough balance for this withdrawal and its fee";
export const WITHDRAWALS_UNAVAILABLE = "Withdrawals are temporarily unavailable. Please try again shortly.";

const postWithdrawal = async (req: Request, res: Response) => {
    try {
        const { bankAccountId, amount, expectedTotal, idempotencyKey, pin } = req.body;
        const { id: userId } = req.user!;

        const validated = await postWithdrawalSchema.parseAsync({ userId, bankAccountId, amount, expectedTotal, idempotencyKey, pin });

        const { data, failure, verification, isNew, limits } = await createWithdrawal({
            userId,
            bankAccountId: validated.bankAccountId,
            amount: validated.amount,
            expectedTotal: validated.expectedTotal,
            idempotencyKey: validated.idempotencyKey,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return handlePinFailure({ res, req, verification });
        if (failure === ACTION_FAILURE.BANK_UNSUPPORTED) return handleError({ res, req, message: BANK_UNSUPPORTED, code: 400 });
        if (failure === ACTION_FAILURE.AMOUNT_OUT_OF_RANGE && limits) return handleError({ res, req, message: describeLimits({ amount: validated.amount, limits }), code: 400 });
        if (failure === ACTION_FAILURE.QUOTE_CHANGED) return handleError({ res, req, message: QUOTE_CHANGED, code: 409 });
        if (failure === ACTION_FAILURE.INSUFFICIENT_BALANCE) return handleError({ res, req, message: WITHDRAWAL_INSUFFICIENT_BALANCE, code: 402 });
        if (failure === ACTION_FAILURE.PROVIDER_UNAVAILABLE) return handleError({ res, req, message: WITHDRAWALS_UNAVAILABLE, code: 503 });

        res.set("Cache-Control", "no-store");

        return isNew
            ? handleSuccess({ res, req, message: "Withdrawal sent", code: 201, data })
            : handleSuccess({ res, req, message: "Withdrawal already sent", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to send withdrawal", error });
    }
};

export default postWithdrawal;
