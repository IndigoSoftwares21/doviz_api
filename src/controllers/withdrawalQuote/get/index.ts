import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import maskAccountNumber from "@/utils/banks/maskAccountNumber";
import fetchWithdrawalQuote from "@/actions/withdrawalQuote/fetchWithdrawalQuote";
import getWithdrawalQuoteSchema from "./schema/getWithdrawalQuoteSchema";
import ACTION_FAILURE from "@/constants/actionFailure";
import describeLimits from "@/utils/withdrawals/describeLimits";

export const BANK_UNSUPPORTED = "Withdrawals to this bank are unavailable right now. Try another of your accounts.";

const getWithdrawalQuote = async (req: Request, res: Response) => {
    try {
        const { bankAccountId, amount } = req.query;
        const { id: userId } = req.user!;

        const validated = await getWithdrawalQuoteSchema.parseAsync({ userId, bankAccountId, amount });

        const { data, failure, limits } = await fetchWithdrawalQuote({ userId, bankAccountId: validated.bankAccountId, amount: validated.amount });
        if (failure === ACTION_FAILURE.AMOUNT_OUT_OF_RANGE && limits) return handleError({ res, req, message: describeLimits({ amount: validated.amount, limits }), code: 400 });
        if (failure === ACTION_FAILURE.BANK_UNSUPPORTED || !data) return handleError({ res, req, message: BANK_UNSUPPORTED, code: 400 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({
            res,
            req,
            message: "Withdrawal quote",
            code: 200,
            data: {
                bankAccount: { id: data.account.id, bankName: data.account.bankName, accountNumber: maskAccountNumber({ accountNumber: data.account.accountNumber }), accountName: data.account.accountName },
                currency: data.currency,
                amount: data.amount,
                fee: data.fee,
                feeIsExact: data.feeIsExact,
                totalHeld: data.totalHeld,
            },
        });
    } catch (error) {
        return handleError({ res, req, message: "Failed to price withdrawal", error });
    }
};

export default getWithdrawalQuote;
