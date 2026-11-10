import { z } from "zod";
import selectListableBiller from "@/schemaHelpers/selectListableBiller";

// provider/environment from the active bill provider.
const getBillProductsSchema = z
    .object({
        provider: z.string(),
        environment: z.string(),
        billerId: z.string({ required_error: "Biller is required" }).uuid("Invalid biller"),
    })
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.billerId).success) return;

        const biller = await selectListableBiller({ billerId: values.billerId, provider: values.provider, environment: values.environment });
        if (!biller) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["billerId"], message: "This biller isn't available" });
        }
    });

export default getBillProductsSchema;
