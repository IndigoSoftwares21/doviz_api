import { z } from "zod";

const getWithdrawalSchema = z.object({
    withdrawalId: z.string({ required_error: "Withdrawal is required" }).uuid("Invalid withdrawal"),
});

export default getWithdrawalSchema;
