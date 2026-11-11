import BreetClient from "./breetClient";
import { BreetRateQuote } from "./breetTypes";

/** Breet's sell calculator for $1 of an asset: the naira it pays and the coin it takes. */
const fetchBreetUsdRate = ({ client, providerAssetId }: { client: BreetClient; providerAssetId: string }) =>
    client.request<BreetRateQuote>({
        method: "POST",
        path: `/trades/pbc/sell/rate-calculator/${encodeURIComponent(providerAssetId)}`,
        body: { amountInUSD: 1, currency: "ngn" },
    });

export default fetchBreetUsdRate;
