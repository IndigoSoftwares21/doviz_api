import { z } from "zod";
import selectEnabledProviderAsset from "@/schemaHelpers/selectEnabledProviderAsset";
import isCryptoAmount from "@/utils/money/isCryptoAmount";

// provider/environment come from config, not the request.
const getCryptoQuoteSchema = z
    .object({
        provider: z.string(),
        environment: z.string(),
        assetId: z.string({ required_error: "Asset is required" }).uuid("Invalid asset"),
        cryptoAmount: z.string({ required_error: "Amount is required" }).trim().min(1, "Amount is required"),
    })
    .superRefine(async (values, ctx) => {
        if (!z.string().uuid().safeParse(values.assetId).success) return;

        const asset = await selectEnabledProviderAsset({
            assetId: values.assetId,
            provider: values.provider,
            environment: values.environment,
        });

        if (!asset) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assetId"], message: "This coin isn't available" });
            return;
        }

        if (!isCryptoAmount({ value: values.cryptoAmount, decimals: asset.decimals })) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["cryptoAmount"],
                message: `Enter an amount greater than 0 with at most ${asset.decimals} decimal places`,
            });
        }
    });

export default getCryptoQuoteSchema;
