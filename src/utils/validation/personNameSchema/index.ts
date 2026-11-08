import { z } from "zod";
import USER from "@/constants/user";

// Legal names: any script's letters (incl. tone marks like "Adéṣọlá"),
// spaces, hyphens and apostrophes ("O'Neil", "Okafor-Eze"). No digits or
// emoji. Normalised to NFC with whitespace collapsed, so the same name is
// always stored the same way for KYC matching.
const personNameSchema = ({ label }: { label: string }) =>
    z
        .string({ required_error: `${label} is required` })
        .transform((value) => value.normalize("NFC").trim().replace(/\s+/g, " "))
        .pipe(
            z
                .string()
                .min(1, `${label} is required`)
                .max(USER.NAME_MAX_LENGTH, `${label} must be ${USER.NAME_MAX_LENGTH} characters or fewer`)
                .regex(
                    /^\p{L}[\p{L}\p{M}' ’-]*$/u,
                    `${label} can only contain letters, spaces, hyphens and apostrophes`,
                ),
        );

export default personNameSchema;
