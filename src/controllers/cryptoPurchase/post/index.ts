import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createCryptoPurchase from "@/actions/cryptoPurchase/createCryptoPurchase";
import cryptoPurchaseFailureResponse from "@/utils/cryptoPurchases/cryptoPurchaseFailureResponse";
import postCryptoPurchaseSchema from "./schema/postCryptoPurchaseSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";

const postCryptoPurchase = async (req: Request, res: Response) => {
    try {
        const { assetId, cryptoAmount, nairaTotal, address, memo, expectedTotal, expectedCryptoAmount, idempotencyKey, pin } = req.body;
        const { id: userId } = req.user!;

        const validated = await postCryptoPurchaseSchema.parseAsync({
            assetId,
            cryptoAmount,
            nairaTotal,
            address,
            memo,
            expectedTotal,
            expectedCryptoAmount,
            idempotencyKey,
            pin,
        });

        const { data, failure, verification, isNew, limits } = await createCryptoPurchase({
            userId,
            assetId: validated.assetId,
            cryptoAmount: validated.cryptoAmount ?? null,
            nairaTotal: validated.nairaTotal ?? null,
            address: validated.address,
            memo: validated.memo ?? null,
            expectedTotal: validated.expectedTotal,
            expectedCryptoAmount: validated.expectedCryptoAmount ?? null,
            idempotencyKey: validated.idempotencyKey,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return handlePinFailure({ res, req, verification });
        const failed = cryptoPurchaseFailureResponse({ failure, limits });
        if (failed) return handleError({ res, req, message: failed.message, code: failed.code });

        res.set("Cache-Control", "no-store");

        return isNew
            ? handleSuccess({ res, req, message: "Crypto purchase sent", code: 201, data })
            : handleSuccess({ res, req, message: "Crypto purchase already sent", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to buy crypto", error });
    }
};

export default postCryptoPurchase;
