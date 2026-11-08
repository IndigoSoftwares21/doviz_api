import { z } from "zod";
import deviceIdSchema from "@/utils/validation/deviceIdSchema";

const deleteDeviceSchema = z.object({ deviceId: deviceIdSchema });

export default deleteDeviceSchema;
