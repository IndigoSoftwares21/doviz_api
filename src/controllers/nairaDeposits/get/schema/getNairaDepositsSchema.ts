import { z } from "zod";
import NAIRA_DEPOSITS from "@/constants/nairaDeposits";

const getNairaDepositsSchema = z.object({
    limit: z.preprocess(
        (value) => (value === undefined ? undefined : Number(value)),
        z.number().int().positive().max(NAIRA_DEPOSITS.HISTORY_MAX_LIMIT).optional().default(NAIRA_DEPOSITS.HISTORY_DEFAULT_LIMIT),
    ),
    offset: z.preprocess(
        (value) => (value === undefined ? undefined : Number(value)),
        z.number().int().min(0).optional().default(0),
    ),
});

export default getNairaDepositsSchema;
