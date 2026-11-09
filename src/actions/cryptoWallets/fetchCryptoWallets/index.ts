import selectUserWallets from "./queries/selectUserWallets";
import { WALLET_STATUS } from "@/constants/cryptoStatus";

/** Retired addresses are listed (deposits to them may still arrive) but flagged. */
const fetchCryptoWallets = async ({ userId }: { userId: string }) => {
    const walletRows = await selectUserWallets({ userId });

    const data = walletRows.map((wallet) => ({
        id: wallet.id,
        assetId: wallet.assetId,
        symbol: wallet.symbol,
        network: wallet.network,
        address: wallet.address,
        status: wallet.status,
        isPrimary: wallet.isPrimary,
        isRetired: wallet.status === WALLET_STATUS.RETIRED,
        createdAt: wallet.createdAt,
        retiredAt: wallet.retiredAt,
    }));

    return { data };
};

export default fetchCryptoWallets;
