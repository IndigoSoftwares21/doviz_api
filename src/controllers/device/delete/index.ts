import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import removeDevice from "@/actions/device/removeDevice";
import deleteDeviceSchema from "./schema/deleteDeviceSchema";

const deleteDevice = async (req: Request, res: Response) => {
    try {
        const { deviceId } = req.params;
        const { id: userId } = req.user!;

        const validated = await deleteDeviceSchema.parseAsync({ deviceId });

        const { data } = await removeDevice({
            userId,
            deviceId: validated.deviceId,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        return handleSuccess({ res, req, message: "Device signed out", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to sign out device", error });
    }
};

export default deleteDevice;
