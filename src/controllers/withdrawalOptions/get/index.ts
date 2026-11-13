import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import { canSendToOthers } from "@/actions/appSettings/fetchAppSetting";

/** What the app may offer for sending money out: `toOthers` = to any bank account (a server switch). */
const getWithdrawalOptions = async (req: Request, res: Response) => {
    try {
        res.set("Cache-Control", "no-store");
        return handleSuccess({ res, req, message: "Withdrawal options", code: 200, data: { toOthers: await canSendToOthers() } });
    } catch (error) {
        return handleError({ res, req, message: "Failed to get withdrawal options", error });
    }
};

export default getWithdrawalOptions;
