import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchCryptoQuote from "@/actions/cryptoQuote/fetchCryptoQuote";
import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import getCryptoQuoteSchema from "./schema/getCryptoQuoteSchema";
import ACTION_FAILURE from "@/constants/actionFailure";

const getCryptoQuote = async (req: Request, res: Response) => {
    try {
        const { assetId, cryptoAmount } = req.query;

        const validated = await getCryptoQuoteSchema.parseAsync({
            provider: providerRegistry.active().name,
            environment: getProviderEnvironment(),
            assetId,
            cryptoAmount,
        });

        const { data, failure } = await fetchCryptoQuote({
            assetId: validated.assetId,
            cryptoAmount: validated.cryptoAmount,
        });

        if (failure === ACTION_FAILURE.MARKUP_MISSING) {
            return handleError({
                res,
                req,
                message: "Conversions are temporarily unavailable. Please try again later.",
                code: 503,
            });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Quote fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch quote", error });
    }
};

export default getCryptoQuote;
