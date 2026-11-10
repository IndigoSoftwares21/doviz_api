import Decimal from "decimal.js";
import { z } from "zod";
import isNairaAmount from "@/utils/money/isNairaAmount";
import WITHDRAWALS from "@/constants/withdrawals";

/** Naira to send, as a decimal string, within the withdrawal limits. */
const withdrawalAmountSchema = z
    .string({ required_error: "Amount is required", invalid_type_error: 'Amount must be a string, e.g. "5000.00"' })
    .trim()
    .refine((value) => isNairaAmount({ value }), "Amount must be a positive amount with at most 2 decimals")
    .refine((value) => !isNairaAmount({ value }) || new Decimal(value).greaterThanOrEqualTo(WITHDRAWALS.MIN_AMOUNT), `Minimum is ₦${WITHDRAWALS.MIN_AMOUNT}`)
    .refine((value) => !isNairaAmount({ value }) || new Decimal(value).lessThanOrEqualTo(WITHDRAWALS.MAX_AMOUNT), "Maximum is ₦5,000,000.00");

export default withdrawalAmountSchema;
