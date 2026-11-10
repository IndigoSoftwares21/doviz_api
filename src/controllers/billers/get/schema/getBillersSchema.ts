import { z } from "zod";
import { BILL_CATEGORY } from "@/constants/bills";

const CATEGORIES = Object.values(BILL_CATEGORY) as [string, ...string[]];

const getBillersSchema = z.object({
    category: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.enum(CATEGORIES, { errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(", ")}` }) }))
        .optional(),
});

export default getBillersSchema;
