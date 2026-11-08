import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import parseBiometricPublicKey from "@/utils/auth/parseBiometricPublicKey";
import selectTransactionPinByUser from "@/schemaHelpers/selectTransactionPinByUser";

const postBiometricSchema = z
    .object({
        userId: z.string(),
        deviceName: z
            .string()
            .trim()
            .max(100)
            .regex(/^[^\p{Cc}]*$/u, "Device name contains invalid characters")
            .optional(),
        publicKey: z
            .string({ required_error: "Public key is required" })
            .trim()
            .refine((publicKey) => parseBiometricPublicKey({ publicKey }) !== null, {
                message: "Public key must be a base64 DER (SPKI) ECDSA P-256 key",
            }),
        pin: pinSchema,
    })
    .superRefine(async (values, ctx) => {
        const existingPin = await selectTransactionPinByUser({ userId: values.userId });

        if (!existingPin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["pin"],
                message: "Set a transfer PIN before turning on biometrics",
            });
        }
    });

export default postBiometricSchema;
