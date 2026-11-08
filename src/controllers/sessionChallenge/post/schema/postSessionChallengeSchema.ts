import { z } from "zod";
import deviceIdSchema from "@/utils/validation/deviceIdSchema";
import refreshTokenSchema from "@/utils/validation/refreshTokenSchema";

const postSessionChallengeSchema = z.object({
    refreshToken: refreshTokenSchema,
    deviceId: deviceIdSchema,
});

export default postSessionChallengeSchema;
