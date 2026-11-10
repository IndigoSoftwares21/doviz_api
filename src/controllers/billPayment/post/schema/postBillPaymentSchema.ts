import Decimal from "decimal.js";
import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import billCustomerIdSchema, { isBillCustomerIdShape } from "@/utils/validation/billCustomerIdSchema";
import isNairaAmount from "@/utils/money/isNairaAmount";
import selectListableBillProduct from "@/schemaHelpers/selectListableBillProduct";
import { BILL_AMOUNT_TYPE } from "@/constants/bills";

const formatted = (value: string) => new Decimal(value).toFixed(2);

// provider/environment from the active bill provider.
const postBillPaymentSchema = z
    .object({
        provider: z.string(),
        environment: z.string(),
        productId: z.string({ required_error: "Product is required" }).uuid("Invalid product"),
        customerId: billCustomerIdSchema,
        amount: z
            .string({ invalid_type_error: "Amount must be a string, e.g. \"1500.00\"" })
            .trim()
            .refine((value) => isNairaAmount({ value }), "Amount must be a positive amount with at most 2 decimals")
            .optional(),
        idempotencyKey: z
            .string({ required_error: "Idempotency key is required" })
            .uuid("Idempotency key must be a UUID — a new one per payment, reused only to retry the same payment"),
        pin: pinSchema,
    })
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.productId).success) return;
        if (!isBillCustomerIdShape({ value: values.customerId })) return;

        const product = await selectListableBillProduct({ productId: values.productId, provider: values.provider, environment: values.environment });
        if (!product) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productId"], message: "This product isn't available" });
            return;
        }

        if (product.customerIdPattern && !new RegExp(product.customerIdPattern).test(values.customerId)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerId"], message: `Enter a valid ${product.customerIdLabel.toLowerCase()}` });
        }

        const amount = values.amount && isNairaAmount({ value: values.amount }) ? new Decimal(values.amount) : null;
        if (product.amountType === BILL_AMOUNT_TYPE.FIXED) {
            if (values.amount && amount && product.price && !amount.equals(product.price)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: `This plan costs ${formatted(product.price)}` });
            }
            return;
        }

        if (!values.amount) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Amount is required" });
            return;
        }
        if (amount && product.minAmount && amount.lessThan(product.minAmount)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: `Minimum is ${formatted(product.minAmount)}` });
        }
        if (amount && product.maxAmount && amount.greaterThan(product.maxAmount)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: `Maximum is ${formatted(product.maxAmount)}` });
        }
    });

export default postBillPaymentSchema;
