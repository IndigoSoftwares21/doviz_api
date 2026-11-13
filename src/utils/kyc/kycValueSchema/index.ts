import { z } from "zod";
import personNameSchema from "@/utils/validation/personNameSchema";
import isIsoDate from "@/utils/kyc/isIsoDate";
import ageOn from "@/utils/kyc/ageOn";
import { KYC_FIELD_TYPE, KycFieldDefinition } from "@/constants/kycFields";

const tidy = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ");

/**
 * The rules for one KYC field, built from its definition — the same
 * definition the app draws the form from. Normalises what it accepts.
 * Messages never repeat what was typed: these are personal details.
 */
const kycValueSchema = (field: KycFieldDefinition): z.ZodType<string, z.ZodTypeDef, unknown> => {
    const required = { required_error: `Enter your ${field.label.toLowerCase()}`, invalid_type_error: `Enter your ${field.label.toLowerCase()}` };

    switch (field.type) {
        case KYC_FIELD_TYPE.NAME:
            return personNameSchema({ label: field.label });
        case KYC_FIELD_TYPE.DIGITS:
            return z
                .string(required)
                .transform((value) => value.replace(/[\s-]/g, ""))
                .pipe(z.string().regex(new RegExp(`^\\d{${field.length}}$`), `Your ${field.label} is ${field.length} digits`));
        case KYC_FIELD_TYPE.DATE: {
            const age = (value: string) => ageOn({ dateOfBirth: value, today: new Date() });
            return z
                .string(required)
                .trim()
                .refine(isIsoDate, `Enter your ${field.label.toLowerCase()} as YYYY-MM-DD`)
                .refine((value) => !isIsoDate(value) || field.minAge === undefined || age(value) >= field.minAge, `You must be at least ${field.minAge}`)
                .refine((value) => !isIsoDate(value) || field.maxAge === undefined || age(value) <= field.maxAge, `Check your ${field.label.toLowerCase()}`);
        }
        case KYC_FIELD_TYPE.CHOICE: {
            const allowed = (field.options ?? []).map((option) => option.value);
            return z.string(required).refine((value) => allowed.includes(value), `Choose your ${field.label.toLowerCase()}`);
        }
        case KYC_FIELD_TYPE.TEXT:
            return z
                .string(required)
                .transform(tidy)
                .pipe(
                    z
                        .string()
                        .min(field.minLength ?? 1, `Enter your full ${field.label.toLowerCase()}`)
                        .max(field.maxLength ?? 255, `Keep your ${field.label.toLowerCase()} to ${field.maxLength ?? 255} characters`)
                        .regex(/^[^<>{}\u0000-\u001f]+$/u, `Your ${field.label.toLowerCase()} has characters we can't accept`),
                );
    }
};

export default kycValueSchema;
