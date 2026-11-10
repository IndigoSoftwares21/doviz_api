import { z } from "zod";

const getNairaDepositSchema = z.object({
    nairaDepositId: z.string({ required_error: "Deposit is required" }).uuid("Invalid deposit"),
});

export default getNairaDepositSchema;
