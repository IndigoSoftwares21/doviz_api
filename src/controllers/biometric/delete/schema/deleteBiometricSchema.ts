import { z } from "zod";
import deviceIdSchema from "@/utils/validation/deviceIdSchema";

const deleteBiometricSchema = z.object({ deviceId: deviceIdSchema });

export default deleteBiometricSchema;
