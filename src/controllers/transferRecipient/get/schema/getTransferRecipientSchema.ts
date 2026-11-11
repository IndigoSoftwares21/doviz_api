import { z } from "zod";
import normaliseTag from "@/utils/ziktags/normaliseTag";
import ZIKTAGS from "@/constants/ziktags";

// "@Ada", "ada" → "ada". A malformed tag can't belong to anyone.
const getTransferRecipientSchema = z.object({
    tag: z
        .string({ required_error: "Ziktag is required" })
        .max(40, "Enter a valid Ziktag")
        .transform((value) => normaliseTag({ value }))
        .refine((value) => ZIKTAGS.FORMAT.test(value), "Enter a valid Ziktag"),
});

export default getTransferRecipientSchema;
