/**
 * The coins Doviz SELLS to users (buying with naira), in our own vocabulary
 * (crypto_assets: symbol + network). Adding one here + a sync is all it takes.
 */
export const BUYABLE_ASSETS = [
    { symbol: "USDT", network: "TRC20", name: "Tether USD (TRC20)", decimals: 6 },
    { symbol: "USDT", network: "BEP20", name: "Tether USD (BEP20)", decimals: 6 },
] as const;

/**
 * Each provider's network ids → ours. The only place a provider's chain names
 * meet ours; an id not listed is skipped (and logged), never guessed.
 */
export const PROVIDER_NETWORK_ALIASES: Record<string, Record<string, string>> = {
    kucoin: { trx: "TRC20", bsc: "BEP20", eth: "ERC20" },
    fakesend: { trx: "TRC20", bsc: "BEP20" },
};
