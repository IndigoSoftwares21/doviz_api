import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createCryptoWallet from "@/actions/cryptoWallet/createCryptoWallet";
import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import postCryptoWalletSchema from "./schema/postCryptoWalletSchema";
import ACTION_FAILURE from "@/constants/actionFailure";

const postCryptoWallet = async (req: Request, res: Response) => {
    try {
        const { assetId } = req.body;
        const { id: userId } = req.user!;

        const validated = await postCryptoWalletSchema.parseAsync({
            userId,
            provider: providerRegistry.active().name,
            environment: getProviderEnvironment(),
            assetId,
        });

        const { data, failure } = await createCryptoWallet({
            userId,
            assetId: validated.assetId,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (failure === ACTION_FAILURE.PROVIDER_UNAVAILABLE) {
            return handleError({
                res,
                req,
                message: "We couldn't create your deposit address right now. Please try again in a moment.",
                code: 503,
            });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Deposit address ready", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to get deposit address", error });
    }
};

export default postCryptoWallet;
