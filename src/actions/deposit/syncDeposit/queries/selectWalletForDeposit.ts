import { db } from "@/database";
import { WALLET_STATUS } from "@/constants/cryptoStatus";

/**
 * Our wallet for a provider deposit: matched on provider + address AND the
 * provider's asset code, so a deposit of the wrong coin to a known address
 * never credits as the wallet's coin.
 */
const selectWalletForDeposit = async ({
    provider,
    address,
    providerCode,
}: {
    provider: string;
    address: string;
    providerCode: string;
}) => {
    const walletRow = await db
        .selectFrom("crypto_wallets")
        .innerJoin("crypto_provider_assets", (join) =>
            join
                .onRef("crypto_provider_assets.assetId", "=", "crypto_wallets.assetId")
                .onRef("crypto_provider_assets.provider", "=", "crypto_wallets.provider"),
        )
        .innerJoin("crypto_assets", "crypto_assets.id", "crypto_wallets.assetId")
        .select([
            "crypto_wallets.id as walletId",
            "crypto_wallets.userId",
            "crypto_wallets.assetId",
            "crypto_assets.symbol",
            "crypto_assets.decimals",
        ])
        .where("crypto_wallets.provider", "=", provider)
        .where("crypto_wallets.address", "=", address)
        .where("crypto_wallets.status", "in", [WALLET_STATUS.ACTIVE, WALLET_STATUS.RETIRED])
        .where("crypto_provider_assets.providerCode", "=", providerCode)
        .executeTakeFirst();

    return walletRow;
};

export default selectWalletForDeposit;
