import { z } from "zod";
import withdrawalAmountSchema from "@/utils/validation/withdrawalAmountSchema";
import { checkDestination, destinationFields, toDestination } from "@/utils/validation/withdrawalDestination";

// userId from requireAuth. To one of the user's own active accounts, or to any account (bank + number).
const getWithdrawalQuoteSchema = z
    .object({ userId: z.string(), ...destinationFields, amount: withdrawalAmountSchema })
    .superRefine(checkDestination)
    .transform((values) => ({ userId: values.userId, amount: values.amount, destination: toDestination(values) }));

export default getWithdrawalQuoteSchema;
