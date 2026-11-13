import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createVirtualAccount from "@/actions/virtualAccount/createVirtualAccount";
import ACTION_FAILURE from "@/constants/actionFailure";
import { NAIRA_FUNDING_MESSAGES } from "@/constants/nairaFunding";

/**
 * "Get my account number": creates it from the user's verified KYC, or
 * returns the one they have. Safe to tap again. No PIN — no money moves.
 */
const postUserVirtualAccount = async (req: Request, res: Response) => {
    try {
        const { data, failure, isNew } = await createVirtualAccount({ userId: req.user!.id });
        res.set("Cache-Control", "no-store");
        if (failure === ACTION_FAILURE.KYC_REQUIRED) return handleError({ res, req, message: NAIRA_FUNDING_MESSAGES.VERIFY_FIRST, code: 409 });
        if (failure === ACTION_FAILURE.ACCOUNT_NUMBERS_OFF) return handleError({ res, req, message: NAIRA_FUNDING_MESSAGES.ACCOUNT_UNAVAILABLE, code: 409 });
        if (failure === ACTION_FAILURE.VIRTUAL_ACCOUNT_REFUSED) return handleError({ res, req, message: NAIRA_FUNDING_MESSAGES.ACCOUNT_REFUSED, code: 422 });
        if (failure || !data) return handleError({ res, req, message: NAIRA_FUNDING_MESSAGES.ACCOUNT_UNAVAILABLE, code: 503 });
        return handleSuccess({ res, req, message: isNew ? "Your account number is ready" : "Your account number", code: isNew ? 201 : 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to create your account number", error });
    }
};

export default postUserVirtualAccount;
