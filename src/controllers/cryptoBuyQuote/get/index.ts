import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchCryptoBuyQuote from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";
import cryptoPurchaseFailureResponse from "@/utils/cryptoPurchases/cryptoPurchaseFailureResponse";
import getCryptoBuyQuoteSchema from "./schema/getCryptoBuyQuoteSchema";

const getCryptoBuyQuote = async (req: Request, res: Response) => {
    try {
        const { assetId, cryptoAmount, nairaTotal } = req.query;

        const validated = await getCryptoBuyQuoteSchema.parseAsync({ assetId, cryptoAmount, nairaTotal });

        const { data, failure, limits } = await fetchCryptoBuyQuote(validated);
        if (!data) {
            const failed = cryptoPurchaseFailureResponse({ failure, limits }) ?? { code: 503, message: "Couldn't price this purchase" };
            return handleError({ res, req, message: failed.message, code: failed.code });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({
            res,
            req,
            message: "Crypto quote",
            code: 200,
            data: {
                asset: data.asset,
                memoRequired: data.memoRequired,
                cryptoAmount: data.cryptoAmount,
                networkFee: data.networkFee,
                unitPrice: data.unitPrice,
                currency: data.currency,
                nairaAmount: data.nairaAmount,
                nairaFee: data.nairaFee,
                total: data.total,
                expiresAt: data.rateExpiresAt,
            },
        });
    } catch (error) {
        return handleError({ res, req, message: "Failed to price this purchase", error });
    }
};

export default getCryptoBuyQuote;
