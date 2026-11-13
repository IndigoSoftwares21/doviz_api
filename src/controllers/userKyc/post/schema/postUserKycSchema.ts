import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import personNameSchema from "@/utils/validation/personNameSchema";
import KYC, { KYC_GENDER } from "@/constants/kyc";

/** Whole years between an ISO birth date and today (UTC). */
const ageOn = ({ dateOfBirth, today }: { dateOfBirth: string; today: Date }) => {
    const [year, month, day] = dateOfBirth.split("-").map(Number);
    const birthdayPassed = today.getUTCMonth() + 1 > month || (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
    return today.getUTCFullYear() - year - (birthdayPassed ? 0 : 1);
};

/** A real calendar date in YYYY-MM-DD (rejects 2001-02-30). */
const isIsoDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// Messages never echo what was typed — these are personal details.
const postUserKycSchema = z.object({
    bvn: z
        .string({ required_error: "Enter your BVN" })
        .transform((value) => value.replace(/[\s-]/g, ""))
        .pipe(z.string().regex(new RegExp(`^\\d{${KYC.BVN_LENGTH}}$`), `Your BVN is ${KYC.BVN_LENGTH} digits`)),
    firstName: personNameSchema({ label: "First name" }),
    // Optional: blank counts as none.
    middleName: z.preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? null : value),
        personNameSchema({ label: "Middle name" }).nullable().optional().transform((value) => value ?? null),
    ),
    lastName: personNameSchema({ label: "Last name" }),
    dateOfBirth: z
        .string({ required_error: "Enter your date of birth" })
        .trim()
        .refine(isIsoDate, "Enter your date of birth as YYYY-MM-DD")
        .refine((value) => !isIsoDate(value) || ageOn({ dateOfBirth: value, today: new Date() }) >= KYC.MIN_AGE, `You must be at least ${KYC.MIN_AGE}`)
        .refine((value) => !isIsoDate(value) || ageOn({ dateOfBirth: value, today: new Date() }) <= KYC.MAX_AGE, "Check your date of birth"),
    gender: z.enum([KYC_GENDER.MALE, KYC_GENDER.FEMALE], { errorMap: () => ({ message: "Choose male or female, as on your BVN" }) }),
    address: z
        .string({ required_error: "Enter your address" })
        .transform((value) => value.normalize("NFC").trim().replace(/\s+/g, " "))
        .pipe(
            z
                .string()
                .min(KYC.ADDRESS_MIN_LENGTH, "Enter your full address")
                .max(KYC.ADDRESS_MAX_LENGTH, `Keep your address to ${KYC.ADDRESS_MAX_LENGTH} characters`)
                .regex(/^[^<>{}\u0000-\u001f]+$/u, "Your address has characters we can't accept"),
        ),
    pin: pinSchema,
});

export default postUserKycSchema;
