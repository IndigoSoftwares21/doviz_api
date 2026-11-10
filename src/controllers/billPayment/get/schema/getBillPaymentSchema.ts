import { z } from "zod";

const getBillPaymentSchema = z.object({
    billPaymentId: z.string({ required_error: "Payment is required" }).uuid("Invalid payment"),
});

export default getBillPaymentSchema;
