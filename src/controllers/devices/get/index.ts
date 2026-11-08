import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchDevices from "@/actions/devices/fetchDevices";

const getDevices = async (req: Request, res: Response) => {
    try {
        const { id: userId, deviceId } = req.user!;

        const { data } = await fetchDevices({ userId, currentDeviceId: deviceId });

        return handleSuccess({ res, req, message: "Devices fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch devices", error });
    }
};

export default getDevices;
