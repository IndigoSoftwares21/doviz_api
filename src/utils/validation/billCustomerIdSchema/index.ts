import { z } from "zod";

/** Meter / smartcard / account / phone number. Spaces and dashes are dropped ("0803 829 1822" → "08038291822"). */
const billCustomerIdSchema = z
    .string({ required_error: "Customer number is required" })
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(
        z
            .string()
            .min(4, "Customer number is too short")
            .max(64, "Customer number is too long")
            .regex(/^[A-Za-z0-9]+$/, "Customer number can only contain letters and digits"),
    );

export const isBillCustomerIdShape = ({ value }: { value: string }) => /^[A-Za-z0-9]{4,64}$/.test(value);

export default billCustomerIdSchema;
