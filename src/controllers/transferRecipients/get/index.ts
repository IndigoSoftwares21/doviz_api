import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchRecentRecipients from "@/actions/transferRecipients/fetchRecentRecipients";

const getRecentRecipients = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchRecentRecipients({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Recent recipients fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch recent recipients", error });
    }
};

export default getRecentRecipients;
