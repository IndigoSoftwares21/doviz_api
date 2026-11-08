import { z } from "zod";
import AUTH from "@/constants/auth";
import emailSchema from "@/utils/validation/emailSchema";
import selectUserByEmail from "@/schemaHelpers/selectUserByEmail";
import selectLatestEmailVerificationByUser from "@/schemaHelpers/selectLatestEmailVerificationByUser";
import selectEmailVerificationCountByUser from "@/schemaHelpers/selectEmailVerificationCountByUser";

// userId comes from requireAuth and is not re-validated here.
const postEmailVerificationSchema = z
    .object({
        userId: z.string(),
        email: emailSchema,
    })
    .superRefine(async (values, ctx) => {
        // superRefine still runs when a field failed validation.
        if (!emailSchema.safeParse(values.email).success) {
            return;
        }

        const existingUser = await selectUserByEmail({ email: values.email });

        if (existingUser) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["email"],
                message:
                    existingUser.id === values.userId
                        ? "This email is already verified on your account"
                        : "This email is already in use",
            });
            return;
        }

        const latestVerification = await selectLatestEmailVerificationByUser({
            userId: values.userId,
        });

        if (
            latestVerification &&
            Date.now() - latestVerification.createdAt.getTime() <
                AUTH.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["email"],
                message: `Please wait ${AUTH.EMAIL_OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
            });
            return;
        }

        const countRow = await selectEmailVerificationCountByUser({
            userId: values.userId,
            since: new Date(Date.now() - 60 * 60 * 1000),
        });

        if (
            Number(countRow?.emailVerificationCount ?? 0) >=
            AUTH.EMAIL_OTP_MAX_REQUESTS_PER_HOUR
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["email"],
                message:
                    "Too many verification codes requested. Please try again later",
            });
        }
    });

export default postEmailVerificationSchema;
