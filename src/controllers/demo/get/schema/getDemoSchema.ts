import { z } from "zod";

const getDemoSchema = z.object({
    limit: z.preprocess(
        (value) => (value === undefined ? undefined : Number(value)),
        z.number().int().positive().max(100).optional().default(20),
    ),
});

export default getDemoSchema;
