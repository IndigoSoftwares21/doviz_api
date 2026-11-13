import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import kycValueSchema from "@/utils/kyc/kycValueSchema";
import fetchVerifiedKycFields from "@/actions/kycFields/fetchVerifiedKycFields";
import fetchActiveKycLevel from "@/actions/appSettings/fetchActiveKycLevel";
import { KYC_FIELD_TYPE, KYC_FIELDS, KYC_FORMS } from "@/constants/kycFields";

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/**
 * `details` is checked field by field against the form for the level — the
 * same definitions the app drew. A field on file (from the user's verified
 * details) may be
 * left out (it's reused); anything filled in is validated and replaces it.
 * Errors land on `details.<field>`; messages never repeat what was typed.
 */
const postUserKycSchema = z
    .object({
        userId: z.string(),
        /** Sent back from the form; the server's setting decides (a form from before a switch is refused). */
        level: z.string().optional(),
        details: z.record(z.unknown(), { invalid_type_error: "Send your details" }).default({}),
        pin: pinSchema,
    })
    .transform(async ({ userId, level: sentLevel, details, pin }, ctx) => {
        const { data: level } = await fetchActiveKycLevel();
        if (sentLevel !== undefined && sentLevel !== level) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["level"], message: "The verification steps changed. Go back and open verification again." });
            return z.NEVER;
        }
        const form = KYC_FORMS[level];
        const asked = [...form.required, ...form.optional];
        const { data: onFile } = await fetchVerifiedKycFields({ userId });
        const values: Record<string, string> = {};

        for (const key of Object.keys(details)) {
            if (!asked.includes(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["details", key], message: "This isn't part of the form" });
        }
        for (const key of asked) {
            const field = KYC_FIELDS[key];
            if (isBlank(details[key])) {
                if (form.required.includes(key) && (field.fresh || !onFile.has(key))) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["details", key], message: field.type === KYC_FIELD_TYPE.SELFIE ? "Take a selfie" : `Enter your ${field.label.toLowerCase()}` });
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
