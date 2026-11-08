import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import deviceIdSchema from "@/utils/validation/deviceIdSchema";
import refreshTokenSchema from "@/utils/validation/refreshTokenSchema";

// Unlock with exactly one method: `pin`, or `challengeId` + `signature`.
const postSessionUnlockSchema = z
    .object({
        refreshToken: refreshTokenSchema,
        deviceId: deviceIdSchema,
        pin: pinSchema.optional(),
        challengeId: z.string().uuid("Invalid challenge ID").optional(),
        signature: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9+/_-]+={0,2}$/, "Signature must be base64")
            .max(200)
            .optional(),
    })
    .superRefine((values, ctx) => {
        const usesPin = values.pin !== undefined;
        const usesBiometric = values.challengeId !== undefined || values.signature !== undefined;

        if (usesPin === usesBiometric) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["pin"],
                message: "Send either a PIN or a biometric challengeId and signature",
            });
            return;
        }

        if (usesBiometric && (!values.challengeId || !values.signature)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [values.challengeId ? "signature" : "challengeId"],
                message: "Biometric unlock needs both challengeId and signature",
            });
        }
    });

export default postSessionUnlockSchema;
