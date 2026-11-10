import { z } from "zod";
import toLocalPhoneNumber from "@/utils/bills/toLocalPhoneNumber";

// Any common way of writing a Nigerian mobile number → local 11-digit form.
const getBillNetworkSchema = z.object({
    phone: z
        .string({ required_error: "Phone number is required" })
        .transform((value, ctx) => {
            const local = toLocalPhoneNumber({ value });
            if (!local) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Nigerian mobile number" });
                return z.NEVER;
            }
            return local;
        }),
});

export default getBillNetworkSchema;
