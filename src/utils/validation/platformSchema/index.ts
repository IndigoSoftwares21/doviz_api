import { z } from "zod";
import AUTH from "@/constants/auth";

const platformSchema = z.enum(AUTH.DEVICE_PLATFORMS, {
    errorMap: () => ({ message: `Platform must be one of: ${AUTH.DEVICE_PLATFORMS.join(", ")}` }),
});

export default platformSchema;
