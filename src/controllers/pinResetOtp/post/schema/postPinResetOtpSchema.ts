import { z } from "zod";
import AUTH from "@/constants/auth";
import selectUserById from "@/schemaHelpers/selectUserById";
import selectTransactionPinByUser from "@/schemaHelpers/selectTransactionPinByUser";
import selectLatestOtpByPhone from "@/schemaHelpers/selectLatestOtpByPhone";
import selectOtpCountByPhone from "@/schemaHelpers/selectOtpCountByPhone";

// Same per-phone cooldown and hourly cap as login codes (they share the
// limit, which also caps SMS spend per number).
const postPinResetOtpSchema = z
    .object({ userId: z.string() })
    .superRefine(async (values, ctx) => {
        const existingPin = await selectTransactionPinByUser({ userId: values.userId });

        if (!existingPin) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pin"], message: "No transfer PIN is set yet" });
            return;
        }

        const user = await selectUserById({ userId: values.userId });

        if (!user) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["userId"], message: "User not found" });
            return;
        }

        const latestOtp = await selectLatestOtpByPhone({ phoneNumber: user.phoneNumber });

        if (
            latestOtp &&
            Date.now() - latestOtp.createdAt.getTime() < AUTH.OTP_RESEND_COOLDOWN_SECONDS * 1000
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["phoneNumber"],
                message: `Please wait ${AUTH.OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
            });
            return;
        }

        const otpCountRow = await selectOtpCountByPhone({
            phoneNumber: user.phoneNumber,
            since: new Date(Date.now() - 60 * 60 * 1000),
        });

        if (Number(otpCountRow?.otpCount ?? 0) >= AUTH.OTP_MAX_REQUESTS_PER_HOUR) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["phoneNumber"],
                message: "Too many verification codes requested. Please try again later",
            });
        }
    });

export default postPinResetOtpSchema;
