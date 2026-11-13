import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createUserKyc from "@/actions/userKyc/createUserKyc";
import fetchUserKyc from "@/actions/userKyc/fetchUserKyc";
import postUserKycSchema from "./schema/postUserKycSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import { KYC_MESSAGES } from "@/constants/kyc";

// Reads only the fields it needs. Nothing personal is logged or echoed back —
// the response is the masked summary.
const postUserKyc = async (req: Request, res: Response) => {
    try {
        const { bvn, firstName, middleName, lastName, dateOfBirth, gender, address, pin } = req.body ?? {};
        const { id: userId } = req.user!;

        const { pin: validPin, ...details } = await postUserKycSchema.parseAsync({ bvn, firstName, middleName, lastName, dateOfBirth, gender, address, pin });

        const { failure, verification } = await createUserKyc({
            userId,
            details,
            pin: validPin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        res.set("Cache-Control", "no-store");
        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return handlePinFailure({ res, req, verification });
        if (failure === ACTION_FAILURE.KYC_ALREADY_VERIFIED) return handleError({ res, req, message: KYC_MESSAGES.ALREADY_VERIFIED, code: 409 });
        if (failure === ACTION_FAILURE.KYC_IN_REVIEW) return handleError({ res, req, message: KYC_MESSAGES.IN_REVIEW, code: 409 });
        if (failure === ACTION_FAILURE.KYC_BVN_IN_USE) return handleError({ res, req, message: KYC_MESSAGES.BVN_IN_USE, code: 409 });

        const { data } = await fetchUserKyc({ userId });
        return handleSuccess({ res, req, message: "Details received", code: 201, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to submit your details", error });
    }
};

export default postUserKyc;
