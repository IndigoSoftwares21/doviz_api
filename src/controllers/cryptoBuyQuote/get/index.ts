import { Request, Response } from "express";
import Decimal from "decimal.js";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchCryptoBuyQuote from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";
import cryptoPurchaseFailureResponse from "@/utils/cryptoPurchases/cryptoPurchaseFailureResponse";
import getCryptoBuyQuoteSchema from "./schema/getCryptoBuyQuoteSchema";

const getCryptoBuyQuote = async (req: Request, res: Response) => {
    try {
        const { assetId, cryptoAmount, nairaTotal } = req.query;

        const validated = await getCryptoBuyQuoteSchema.parseAsync({ assetId, cryptoAmount, nairaTotal });

        const { data, failure, limits, preview } = await fetchCryptoBuyQuote(validated);
        // Out of limits but priceable: still show the conversion, flagged as not buyable.
        const priced = data ?? preview;
        const failed = data ? null : cryptoPurchaseFailureResponse({ failure, limits });
        if (!priced) {
            const problem = failed ?? { code: 503, message: "Couldn't price this purchase" };
            return handleError({ res, req, message: problem.message, code: problem.code });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({
            res,
            req,
            message: "Crypto quote",
            code: 200,
            data: {
                canBuy: data !== null,
                limitMessage: failed?.message ?? null,
                asset: priced.asset,
                memoRequired: priced.memoRequired,
                // The plain conversion (naira ÷ price), before the network fee comes off.
                convertedAmount: new Decimal(priced.cryptoAmount).plus(priced.networkFee).toFixed(),
                cryptoAmount: priced.cryptoAmount,
                networkFee: priced.networkFee,
                unitPrice: priced.unitPrice,
                currency: priced.currency,
                nairaAmount: priced.nairaAmount,
                nairaFee: priced.nairaFee,
                total: priced.total,
                expiresAt: priced.rateExpiresAt,
            },
        });
    } catch (error) {
        return handleError({ res, req, message: "Failed to price this purchase", error });
    }
};

export default getCryptoBuyQuote;
