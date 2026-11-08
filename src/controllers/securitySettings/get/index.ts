import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchSecuritySettings from "@/actions/securitySettings/fetchSecuritySettings";

const getSecuritySettings = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchSecuritySettings({ userId });

        return handleSuccess({ res, req, message: "Security settings fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch security settings", error });
    }
};

export default getSecuritySettings;
