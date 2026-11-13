import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchVirtualAccount from "@/actions/virtualAccount/fetchVirtualAccount";

/** The signed-in user's personal account number, if they have one. */
const getUserVirtualAccount = async (req: Request, res: Response) => {
    try {
        const { data } = await fetchVirtualAccount({ userId: req.user!.id });
        res.set("Cache-Control", "no-store");
        return handleSuccess({ res, req, message: "Account number", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to get your account number", error });
    }
};

export default getUserVirtualAccount;
