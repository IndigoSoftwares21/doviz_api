import { z } from "zod";
import selectUserLegalName from "@/schemaHelpers/selectUserLegalName";
import selectEnabledProviderAsset from "@/schemaHelpers/selectEnabledProviderAsset";

// userId comes from requireAuth; provider/environment from config.
const postCryptoWalletSchema = z
    .object({
        userId: z.string(),
        provider: z.string(),
        environment: z.string(),
        assetId: z.string({ required_error: "Asset is required" }).uuid("Invalid asset"),
    })
    .superRefine(async (values, ctx) => {
        const user = await selectUserLegalName({ userId: values.userId });

        if (!user?.firstName || !user.lastName || !user.hasPin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["assetId"],
                message: "Finish setting up your account (name and PIN) first",
            });
            return;
        }

        if (!z.string().uuid().safeParse(values.assetId).success) return;

        const asset = await selectEnabledProviderAsset({
            assetId: values.assetId,
            provider: values.provider,
            environment: values.environment,
        });

        if (!asset) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assetId"], message: "This coin isn't available" });
        }
    });

export default postCryptoWalletSchema;
