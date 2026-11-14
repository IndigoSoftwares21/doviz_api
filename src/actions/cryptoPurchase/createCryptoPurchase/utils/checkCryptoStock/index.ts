import Decimal from "decimal.js";
import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import monitoring from "@/utils/monitoring";

/**
 * True when the provider holds enough of the coin for this send (amount +
 * fee), checked live just before the naira is held (the quote's stock figure
 * is cached for a few seconds). A provider that can't report a balance at all
 * is not a reason to refuse: the send itself fails cleanly if short. A lookup
 * that FAILS refuses (nothing is taken): we don't sell what we can't confirm
 * we hold. Too little stock is an ops alert (top up), not the user's problem.
 */
const checkCryptoStock = async ({ provider, providerAssetId, needed }: { provider: CryptoSendProvider; providerAssetId: string; needed: string }) => {
    if (!provider.getBalance) return true;

    let balance: string | null;
    try {
        balance = await provider.getBalance({ providerAssetId });
    } catch (error) {
        monitoring.warn(`${provider.name}: balance check for ${providerAssetId} failed (${(error as Error).message}) — purchase refused`);
        return false;
    }
    if (balance === null) return true;

    if (new Decimal(balance).lessThan(needed)) {
        monitoring.error(`${provider.name}: ${providerAssetId} stock ${balance} is below ${needed} — top up`, new Error("crypto stock low"));
        return false;
    }
    return true;
};

export default checkCryptoStock;
