import { z } from "zod";
import selectListableBillProduct from "@/schemaHelpers/selectListableBillProduct";
import billCustomerIdSchema, { isBillCustomerIdShape } from "@/utils/validation/billCustomerIdSchema";

// provider/environment from the active bill provider.
const postBillCustomerValidationSchema = z
    .object({
        provider: z.string(),
        environment: z.string(),
        productId: z.string({ required_error: "Product is required" }).uuid("Invalid product"),
        customerId: billCustomerIdSchema,
    })
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.productId).success) return;
        if (!isBillCustomerIdShape({ value: values.customerId })) return; // already reported above

        const product = await selectListableBillProduct({ productId: values.productId, provider: values.provider, environment: values.environment });
        if (!product) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productId"], message: "This product isn't available" });
            return;
        }

        if (product.customerIdPattern && !new RegExp(product.customerIdPattern).test(values.customerId)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerId"], message: `Enter a valid ${product.customerIdLabel.toLowerCase()}` });
        }
    });

export default postBillCustomerValidationSchema;
