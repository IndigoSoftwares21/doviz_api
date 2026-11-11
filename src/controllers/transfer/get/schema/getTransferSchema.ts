import { z } from "zod";

const getTransferSchema = z.object({
    transferId: z.string({ required_error: "Transfer is required" }).uuid("Invalid transfer"),
});

export default getTransferSchema;
