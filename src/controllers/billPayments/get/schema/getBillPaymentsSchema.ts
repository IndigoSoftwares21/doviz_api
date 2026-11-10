import { z } from "zod";
import BILLS from "@/constants/bills";

const getBillPaymentsSchema = z.object({
    limit: z.preprocess(
        (value) => (value === undefined ? undefined : Number(value)),
        z.number().int().positive().max(BILLS.HISTORY_MAX_LIMIT).optional().default(BILLS.HISTORY_DEFAULT_LIMIT),
    ),
    offset: z.preprocess(
        (value) => (value === undefined ? undefined : Number(value)),
        z.number().int().min(0).optional().default(0),
    ),
});

export default getBillPaymentsSchema;
