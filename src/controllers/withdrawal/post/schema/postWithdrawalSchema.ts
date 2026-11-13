import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import isNairaAmount from "@/utils/money/isNairaAmount";
import withdrawalAmountSchema from "@/utils/validation/withdrawalAmountSchema";
import { checkDestination, destinationFields, toDestination } from "@/utils/validation/withdrawalDestination";
import WITHDRAWALS from "@/constants/withdrawals";

// The quote's checks (destination, amount limits), plus what's confirmed. The
// narration is the user's own words for the recipient's bank statement.
const postWithdrawalSchema = z
    .object({
        userId: z.string(),
        ...destinationFields,
        amount: withdrawalAmountSchema,
        narration: z
            .string()
            .transform((value) => value.normalize("NFC").trim().replace(/\s+/g, " "))
            .pipe(
                z
                    .string()
                    .max(WITHDRAWALS.NARRATION_MAX_LENGTH, `Keep the description to ${WITHDRAWALS.NARRATION_MAX_LENGTH} characters`)
                    .regex(/^[\p{L}\p{N} .,'&()/-]*$/u, "The description can only use letters, numbers and basic punctuation"),
            )
            .optional()
            .transform((value) => value || null),
        expectedTotal: z
            .string({ required_error: "Confirm the total first" })
            .trim()
            .refine((value) => isNairaAmount({ value }), "Invalid total"),
        idempotencyKey: z
            .string({ required_error: "Idempotency key is required" })
            .uuid("Idempotency key must be a UUID — a new one per withdrawal, reused only to retry the same one"),
        pin: pinSchema,
    })
    .superRefine(checkDestination)
    .transform(({ bankAccountId: _a, bankId: _b, accountNumber: _c, ...values }) => ({ ...values, destination: toDestination({ ...values, bankAccountId: _a, bankId: _b, accountNumber: _c }) }));

export default postWithdrawalSchema;
