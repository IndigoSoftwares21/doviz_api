import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchUserKyc from "@/actions/userKyc/fetchUserKyc";
import fetchKycForm from "@/actions/userKyc/fetchKycForm";

/** The signed-in user's KYC status (masked) and the form to draw — what's asked, and what's already on file. */
const getUserKyc = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const [{ data: status }, { data: form }] = await Promise.all([fetchUserKyc({ userId }), fetchKycForm({ userId })]);
        res.set("Cache-Control", "no-store");
        return handleSuccess({ res, req, message: "KYC status", code: 200, data: { ...status, form } });
    } catch (error) {
        return handleError({ res, req, message: "Failed to get your verification status", error });
    }
};

export default getUserKyc;
