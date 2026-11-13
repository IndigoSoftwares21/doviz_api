import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchUserKyc from "@/actions/userKyc/fetchUserKyc";

/** The signed-in user's KYC status and masked BVN. */
const getUserKyc = async (req: Request, res: Response) => {
    try {
        const { data } = await fetchUserKyc({ userId: req.user!.id });
        res.set("Cache-Control", "no-store");
        return handleSuccess({ res, req, message: "KYC status", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to get your verification status", error });
    }
};

export default getUserKyc;
