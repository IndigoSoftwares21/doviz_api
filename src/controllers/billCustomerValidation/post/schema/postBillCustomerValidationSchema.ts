import { z } from "zod";
import selectListableBillProduct from "@/schemaHelpers/selectListableBillProduct";

// provider/environment from the active bill provider. Spaces and dashes in the
// customer id are dropped ("0803 829 1822" → "08038291822").
const postBillCustomerValidationSchema = z
    .object({
        provider: z.string(),
        environment: z.string(),
        productId: z.string({ required_error: "Product is required" }).uuid("Invalid product"),
        customerId: z
            .string({ required_error: "Customer number is required" })
            .transform((value) => value.replace(/[\s-]/g, ""))
            .pipe(
                z
                    .string()
                    .min(4, "Customer number is too short")
                    .max(64, "Customer number is too long")
                    .regex(/^[A-Za-z0-9]+$/, "Customer number can only contain letters and digits"),
            ),
    })
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.productId).success) return;
        if (!/^[A-Za-z0-9]{4,64}$/.test(values.customerId)) return; // already reported above

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
