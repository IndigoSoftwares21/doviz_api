import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchUser from "@/actions/user/fetchUser";

const getUser = async (req: Request, res: Response) => {
    try {
        const { id: userId, deviceId } = req.user!;

        // Only ever the caller's own record: userId comes from the verified
        // access token, never from the request.
        const { data } = await fetchUser({ userId, deviceId });

        // Personal data — never cached by proxies or the app's HTTP cache.
        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "User fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch user", error });
    }
};

export default getUser;
