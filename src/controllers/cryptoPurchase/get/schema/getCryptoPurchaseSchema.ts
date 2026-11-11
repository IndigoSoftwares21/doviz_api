import { z } from "zod";

const getCryptoPurchaseSchema = z.object({
    purchaseId: z.string({ required_error: "Purchase is required" }).uuid("Invalid purchase"),
});

export default getCryptoPurchaseSchema;
