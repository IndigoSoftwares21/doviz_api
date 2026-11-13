import { z } from "zod";

const getWithdrawalRecipientSchema = z.object({
    bankId: z.string({ required_error: "Choose a bank" }).uuid("Choose a bank"),
    accountNumber: z.string({ required_error: "Enter the account number" }).trim().regex(/^\d{10}$/, "Account numbers are 10 digits"),
});

export default getWithdrawalRecipientSchema;
