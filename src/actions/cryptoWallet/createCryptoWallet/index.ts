import { randomUUID } from "crypto";
import { withTransaction } from "@/database";
import CRYPTO from "@/constants/crypto";
import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import requestDepositAddress from "./utils/requestDepositAddress";
import activateWallet from "./utils/activateWallet";
import selectWalletAsset from "./queries/selectWalletAsset";
import selectCurrentWallet from "./queries/selectCurrentWallet";
import insertPendingWallet from "./queries/insertPendingWallet";
import updateUnsetPrimaryWallets from "./queries/updateUnsetPrimaryWallets";
import updateSetPrimaryWallet from "./queries/updateSetPrimaryWallet";
import { WALLET_STATUS } from "@/constants/cryptoStatus";
import ACTION_FAILURE from "@/constants/actionFailure";

interface ICreateCryptoWallet {
    userId: string;
    assetId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Get-or-create the user's primary address for a coin at the active
 * provider. The row is stored 'pending' (label dvz-<id>) before the provider
 * is called, so retries — and concurrent requests — reuse the same label and
 * can never create a second address.
 */
const createCryptoWallet = async ({ userId, assetId, ipAddress, userAgent }: ICreateCryptoWallet) => {
    const provider = providerRegistry.active();
    const asset = await selectWalletAsset({ assetId, provider: provider.name, environment: getProviderEnvironment() });
    const scope = { userId, assetId, provider: provider.name };

    let wallet = await selectCurrentWallet(scope);
    if (!wallet) {
        const id = randomUUID();
        await insertPendingWallet({
            id,
            userId,
            assetId,
            provider: provider.name,
            label: `${CRYPTO.LABEL_PREFIX}${id}`,
        });
        wallet = await selectCurrentWallet(scope);
    }
    if (!wallet) throw new Error("Deposit address row could not be created");

    if (wallet.status === WALLET_STATUS.PENDING) {
        const issued = await requestDepositAddress({
            provider,
            providerAssetId: asset.providerAssetId,
            providerCode: asset.providerCode,
            label: wallet.label,
        });
        if (!issued) return { data: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE };

        await activateWallet({
            walletId: wallet.id,
            userId,
            assetId,
            address: issued.address,
            providerWalletId: issued.providerWalletId,
            audit: { provider: provider.name, symbol: asset.symbol, network: asset.network, ipAddress, userAgent },
        });
    } else if (!wallet.isPrimary) {
        const walletId = wallet.id;
        await withTransaction(async (trx) => {
            await updateUnsetPrimaryWallets({ trx, userId, assetId, exceptId: walletId });
            await updateSetPrimaryWallet({ trx, id: walletId });
        });
    }

    const current = await selectCurrentWallet(scope);
    if (!current) throw new Error("Deposit address disappeared");
    const data = {
        id: current.id,
        assetId,
        symbol: asset.symbol,
        network: asset.network,
        address: current.address,
        isPrimary: current.isPrimary,
        status: current.status,
        createdAt: current.createdAt,
    };
    return { data, failure: null };
};

export default createCryptoWallet;
