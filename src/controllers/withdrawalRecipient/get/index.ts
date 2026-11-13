import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchWithdrawalRecipient from "@/actions/withdrawalRecipient/fetchWithdrawalRecipient";
import { BANK_UNSUPPORTED, TRANSFERS_TO_OTHERS_OFF, recipientNotFound } from "@/controllers/withdrawalQuote/get";
import getWithdrawalRecipientSchema from "./schema/getWithdrawalRecipientSchema";
import ACTION_FAILURE from "@/constants/actionFailure";

/** Who owns a bank account — for sending to someone else's (shown before the amount). */
const getWithdrawalRecipient = async (req: Request, res: Response) => {
    try {
        const { bankId, accountNumber } = req.query;
        const validated = await getWithdrawalRecipientSchema.parseAsync({ bankId, accountNumber });
        const { data, failure } = await fetchWithdrawalRecipient({ userId: req.user!.id, payoutBankId: validated.bankId, accountNumber: validated.accountNumber });
        if (failure === ACTION_FAILURE.TRANSFERS_TO_OTHERS_OFF) return handleError({ res, req, message: TRANSFERS_TO_OTHERS_OFF, code: 403 });
        if (failure === ACTION_FAILURE.RECIPIENT_ACCOUNT_NOT_FOUND) return handleError({ res, req, error: recipientNotFound() });
        if (!data) return handleError({ res, req, message: BANK_UNSUPPORTED, code: 400 });
        res.set("Cache-Control", "no-store");
        return handleSuccess({ res, req, message: "Account found", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to look up the account", error });
    }
};

export default getWithdrawalRecipient;
