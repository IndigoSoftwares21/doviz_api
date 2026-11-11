import Decimal from "decimal.js";
import { CRYPTO_SEND_ERROR_CODE } from "@/constants/cryptoPurchases";
import CryptoSendProviderError from "../../cryptoSendProviderError";
import KUCOIN from "./constants";
import KucoinClient from "./kucoinClient";

type KucoinTicker = { price?: string; bestAsk?: string | null; bestBid?: string | null } | null;

/**
 * What one coin costs in USDT on KuCoin right now: the best ASK (what buying
 * it to restock would cost us), else the last trade. Public endpoint, no key.
 * A missing or non-positive price throws — the caller never guesses one.
 */
const fetchKucoinUsdtPrice = async ({ client, symbol }: { client: KucoinClient; symbol: string }) => {
    const ticker = await client.request<KucoinTicker>({ method: "GET", path: KUCOIN.PRICE_PATH, query: { symbol: `${symbol.toUpperCase()}-USDT` }, isPublic: true });
    const raw = ticker?.bestAsk || ticker?.price;
    if (!raw || !new Decimal(raw).isFinite() || new Decimal(raw).lessThanOrEqualTo(0)) {
        throw new CryptoSendProviderError({ code: CRYPTO_SEND_ERROR_CODE.INVALID_RESPONSE, status: 200, providerMessage: `KuCoin has no ${symbol}-USDT price` });
    }
    return new Decimal(raw).toFixed();
};

export default fetchKucoinUsdtPrice;
