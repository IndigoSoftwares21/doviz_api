import { z } from "zod";
import isNairaAmount from "@/utils/money/isNairaAmount";

/** A positive coin amount, at most 18 decimals. */
export const isCryptoAmount = (value: string) => /^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/.test(value) && Number(value) > 0;

// Exactly one of: the coin to receive, or the naira to spend in total.
const getCryptoBuyQuoteSchema = z
    .object({
        assetId: z.string({ required_error: "Coin is required" }).uuid("Invalid coin"),
        cryptoAmount: z.string().trim().refine(isCryptoAmount, "Invalid amount").optional(),
        nairaTotal: z.string().trim().refine((value) => isNairaAmount({ value }), "Invalid amount").optional(),
    })
    .refine((values) => Boolean(values.cryptoAmount) !== Boolean(values.nairaTotal), {
        path: ["cryptoAmount"],
        message: "Enter an amount in naira or in crypto",
    });

export default getCryptoBuyQuoteSchema;
