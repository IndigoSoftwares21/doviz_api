import { withTransaction } from "@/database";
import cryptoSendProviderRegistry from "@/services/cryptoSends/cryptoSendProviderRegistry";
import CryptoSendProviderError from "@/services/cryptoSends/cryptoSendProviderError";
import createCryptoPurchaseRefund from "@/actions/cryptoPurchaseRefund/createCryptoPurchaseRefund";
import syncCryptoPurchase from "@/actions/cryptoPurchase/syncCryptoPurchase";
import monitoring from "@/utils/monitoring";
import updateCryptoPurchaseSubmitted from "../../queries/updateCryptoPurchaseSubmitted";
import updateCryptoPurchaseProcessing from "../../queries/updateCryptoPurchaseProcessing";
import { CRYPTO_SEND_ERROR_CODE, PROVIDER_SEND_STATUS } from "@/constants/cryptoPurchases";

const DECLINED = "Your crypto couldn't be sent. Your naira has been returned.";
const UNAVAILABLE = "Buying crypto is temporarily unavailable. Your naira has been returned.";

/**
 * Sends an already-held purchase with ITS provider (the one on the row). The naira is safe whatever happens:
 *   accepted                 → pending until confirmed (follow-up checks / reconciler)
 *   rejected / configuration → definitely not sent → refunded now
 *   anything else            → outcome unknown → `processing`, never refunded on a guess
 */
const submitCryptoPurchase = async ({
    purchaseId,
    provider,
    providerAssetId,
    address,
    memo,
    cryptoAmount,
}: {
    purchaseId: string;
    provider: string;
    providerAssetId: string;
    address: string;
    memo: string | null;
    cryptoAmount: string;
}) => {
    try {
        const sent = await cryptoSendProviderRegistry.get({ name: provider }).send({ externalId: purchaseId, providerAssetId, address, memo, amount: cryptoAmount });
        await updateCryptoPurchaseSubmitted({ id: purchaseId, providerReference: sent.providerReference });
        if (sent.status !== PROVIDER_SEND_STATUS.PENDING) await syncCryptoPurchase({ purchaseId });
    } catch (error) {
        const code = error instanceof CryptoSendProviderError ? error.code : null;
        if (code === CRYPTO_SEND_ERROR_CODE.REJECTED || code === CRYPTO_SEND_ERROR_CODE.CONFIGURATION) {
            if (code === CRYPTO_SEND_ERROR_CODE.CONFIGURATION) {
                monitoring.error(`Crypto purchase ${purchaseId}: ${provider} refused our setup — check keys / permissions / IP / address whitelist`, error as Error);
            }
            const reason = code === CRYPTO_SEND_ERROR_CODE.REJECTED ? DECLINED : UNAVAILABLE;
            await withTransaction((trx) => createCryptoPurchaseRefund({ trx, purchaseId, reason }));
            return;
        }
        monitoring.warn(`Crypto purchase ${purchaseId}: outcome unknown at ${provider} (${code ?? "error"}) — will reconcile`);
        await updateCryptoPurchaseProcessing({ id: purchaseId });
    }
};

export default submitCryptoPurchase;
