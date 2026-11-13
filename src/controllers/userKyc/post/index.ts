import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createUserKyc from "@/actions/userKyc/createUserKyc";
import fetchUserKyc from "@/actions/userKyc/fetchUserKyc";
import createVirtualAccount from "@/actions/virtualAccount/createVirtualAccount";
import monitoring from "@/utils/monitoring";
import postUserKycSchema from "./schema/postUserKycSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import { KYC_MESSAGES } from "@/constants/kyc";
import { KYC_FIELDS } from "@/constants/kycFields";

// Reads only the fields it needs. Nothing personal is logged or echoed back —
// the response is the masked status (verified or rejected: the check runs now).
const postUserKyc = async (req: Request, res: Response) => {
    try {
        const { level, details, pin } = req.body ?? {};
        const { id: userId } = req.user!;

        const validated = await postUserKycSchema.parseAsync({ userId, level, details, pin });

        const { failure, fieldKey, verification } = await createUserKyc({
            userId,
            level: validated.level,
            values: validated.values,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        res.set("Cache-Control", "no-store");
        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return handlePinFailure({ res, req, verification });
        if (failure === ACTION_FAILURE.KYC_ALREADY_VERIFIED) return handleError({ res, req, message: KYC_MESSAGES.ALREADY_VERIFIED, code: 409 });
        if (failure === ACTION_FAILURE.KYC_IN_REVIEW) return handleError({ res, req, message: KYC_MESSAGES.IN_REVIEW, code: 409 });
        if (failure === ACTION_FAILURE.PROVIDER_UNAVAILABLE) return handleError({ res, req, message: KYC_MESSAGES.UNAVAILABLE, code: 503 });
        if (failure === ACTION_FAILURE.KYC_IDENTIFIER_IN_USE) {
            return handleError({ res, req, message: KYC_MESSAGES.identifierInUse(KYC_FIELDS[fieldKey!]?.label ?? "detail"), code: 409 });
        }

        const { data } = await fetchUserKyc({ userId });
        // Verified: open their account number now, in the background — the app hears
        // "virtual_account.ready" over the socket; a failure leaves the button to retry.
        if (data.status === "verified") {
            createVirtualAccount({ userId }).catch((error) => monitoring.error("Couldn't create an account number after verification", error as Error));
        }
        return handleSuccess({ res, req, message: data.status === "verified" ? "You're verified" : "We couldn't verify you", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to submit your details", error });
    }
};

export default postUserKyc;
