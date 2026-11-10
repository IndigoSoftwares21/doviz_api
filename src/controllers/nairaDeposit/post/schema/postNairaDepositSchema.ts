import Decimal from "decimal.js";
import { z } from "zod";
import isNairaAmount from "@/utils/money/isNairaAmount";
import NAIRA_DEPOSITS from "@/constants/nairaDeposits";

const postNairaDepositSchema = z.object({
    amount: z
        .string({ required_error: "Amount is required", invalid_type_error: "Amount must be a string, e.g. \"50000.00\"" })
        .trim()
        .refine((value) => isNairaAmount({ value }), "Amount must be a positive amount with at most 2 decimals")
        .refine((value) => !isNairaAmount({ value }) || new Decimal(value).greaterThanOrEqualTo(NAIRA_DEPOSITS.MIN_AMOUNT), `Minimum deposit is ${NAIRA_DEPOSITS.MIN_AMOUNT}`)
        .refine((value) => !isNairaAmount({ value }) || new Decimal(value).lessThanOrEqualTo(NAIRA_DEPOSITS.MAX_AMOUNT), `Maximum deposit is ${NAIRA_DEPOSITS.MAX_AMOUNT}`)
        .transform((value) => new Decimal(value).toFixed(2)),
    idempotencyKey: z
        .string({ required_error: "Idempotency key is required" })
        .uuid("Idempotency key must be a UUID — a new one per deposit, reused only to retry the same deposit"),
});

export default postNairaDepositSchema;
