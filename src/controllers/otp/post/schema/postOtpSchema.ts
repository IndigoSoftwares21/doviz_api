import { z } from "zod";
import AUTH from "@/constants/auth";
import phoneNumberSchema from "@/utils/validation/phoneNumberSchema";
import selectLatestOtpByPhone from "@/schemaHelpers/selectLatestOtpByPhone";
import selectOtpCountByPhone from "@/schemaHelpers/selectOtpCountByPhone";

const postOtpSchema = z
    .object({
        phoneNumber: phoneNumberSchema,
    })
    .superRefine(async (values, ctx) => {
        // superRefine still runs when a field failed validation — don't hit
        // the DB with a malformed number.
        if (
            typeof values.phoneNumber !== "string" ||
            !AUTH.E164_REGEX.test(values.phoneNumber)
        ) {
            return;
        }

        const latestOtp = await selectLatestOtpByPhone({
            phoneNumber: values.phoneNumber,
        });

        if (
            latestOtp?.createdAt &&
            Date.now() - latestOtp.createdAt.getTime() <
                AUTH.OTP_RESEND_COOLDOWN_SECONDS * 1000
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["phoneNumber"],
                message: `Please wait ${AUTH.OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
            });
            return;
        }

        const otpCountRow = await selectOtpCountByPhone({
            phoneNumber: values.phoneNumber,
            since: new Date(Date.now() - 60 * 60 * 1000),
        });

        if (Number(otpCountRow?.otpCount ?? 0) >= AUTH.OTP_MAX_REQUESTS_PER_HOUR) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["phoneNumber"],
                message:
                    "Too many verification codes requested. Please try again later",
            });
        }
    });

export default postOtpSchema;
