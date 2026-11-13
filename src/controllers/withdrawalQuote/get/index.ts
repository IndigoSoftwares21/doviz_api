import { Request, Response } from "express";
import { ZodError } from "zod";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import maskAccountNumber from "@/utils/banks/maskAccountNumber";
import fetchWithdrawalQuote from "@/actions/withdrawalQuote/fetchWithdrawalQuote";
import getWithdrawalQuoteSchema from "./schema/getWithdrawalQuoteSchema";
import ACTION_FAILURE from "@/constants/actionFailure";
import describeLimits from "@/utils/withdrawals/describeLimits";

export const BANK_UNSUPPORTED = "Withdrawals to this bank are unavailable right now. Try another of your accounts.";
export const TRANSFERS_TO_OTHERS_OFF = "Sending to other people's bank accounts isn't available yet.";
export const RECIPIENT_NOT_FOUND = "We couldn't find this account. Check the number and the bank.";

/** The account-number field's error, as the app shows validation errors. */
export const recipientNotFound = () => new ZodError([{ code: "custom", path: ["accountNumber"], message: RECIPIENT_NOT_FOUND }]);

const getWithdrawalQuote = async (req: Request, res: Response) => {
    try {
        const { bankAccountId, bankId, accountNumber, amount } = req.query;
        const { id: userId } = req.user!;

        const validated = await getWithdrawalQuoteSchema.parseAsync({ userId, bankAccountId, bankId, accountNumber, amount });

        const { data, failure, limits } = await fetchWithdrawalQuote({ userId, destination: validated.destination, amount: validated.amount });
        if (failure === ACTION_FAILURE.TRANSFERS_TO_OTHERS_OFF) return handleError({ res, req, message: TRANSFERS_TO_OTHERS_OFF, code: 403 });
        if (failure === ACTION_FAILURE.RECIPIENT_ACCOUNT_NOT_FOUND) return handleError({ res, req, error: recipientNotFound() });
        if (failure === ACTION_FAILURE.AMOUNT_OUT_OF_RANGE && limits) return handleError({ res, req, message: describeLimits({ amount: validated.amount, limits }), code: 400 });
        if (failure === ACTION_FAILURE.BANK_UNSUPPORTED || !data) return handleError({ res, req, message: BANK_UNSUPPORTED, code: 400 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({
            res,
            req,
            message: "Withdrawal quote",
            code: 200,
            data: {
                // Own account: masked as in the account list. Someone else's: in full, with the name
                // their bank returned, so the user can check it's the right person before the PIN.
                bankAccount: {
                    id: data.account.bankAccountId,
                    bankName: data.account.bankName,
                    accountNumber: data.account.bankAccountId ? maskAccountNumber({ accountNumber: data.account.accountNumber }) : data.account.accountNumber,
                    accountName: data.account.accountName,
                },
                toSomeoneElse: data.account.bankAccountId === null,
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
