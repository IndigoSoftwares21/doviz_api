import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import kycValueSchema from "@/utils/kyc/kycValueSchema";
import fetchCurrentKycFields from "@/actions/kycFields/fetchCurrentKycFields";
import { KYC_LEVEL } from "@/constants/kyc";
import { KYC_FIELDS, KYC_FORMS } from "@/constants/kycFields";

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/**
 * `details` is checked field by field against the form for the level — the
 * same definitions the app drew. A field the user already has on file may be
 * left out (it's reused); anything filled in is validated and replaces it.
 * Errors land on `details.<field>`; messages never repeat what was typed.
 */
const postUserKycSchema = z
    .object({
        userId: z.string(),
        level: z.enum([KYC_LEVEL.BVN], { errorMap: () => ({ message: "That verification level isn't available" }) }).default(KYC_LEVEL.BVN),
        details: z.record(z.unknown(), { invalid_type_error: "Send your details" }).default({}),
        pin: pinSchema,
    })
    .transform(async ({ userId, level, details, pin }, ctx) => {
        const form = KYC_FORMS[level];
        const asked = [...form.required, ...form.optional];
        const { data: onFile } = await fetchCurrentKycFields({ userId });
        const values: Record<string, string> = {};

        for (const key of Object.keys(details)) {
            if (!asked.includes(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["details", key], message: "This isn't part of the form" });
        }
        for (const key of asked) {
            const field = KYC_FIELDS[key];
            if (isBlank(details[key])) {
                if (form.required.includes(key) && !onFile.has(key)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["details", key], message: `Enter your ${field.label.toLowerCase()}` });
                }
                continue;
            }
            const parsed = await kycValueSchema(field).safeParseAsync(details[key]);
            if (parsed.success) values[key] = parsed.data;
            else for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: ["details", key] });
        }
        return { level, values, pin };
    });

export default postUserKycSchema;
