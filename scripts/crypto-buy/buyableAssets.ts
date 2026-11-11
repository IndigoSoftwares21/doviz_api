/**
 * The coins Ziks SELLS to users (buying with naira), in our own vocabulary
 * (crypto_assets: symbol + network). Adding one here + a sync is all it takes
 * — but only on a network isValidCryptoAddress can check.
 */
const coin = (symbol: string, label: string, decimals: number) => (network: string, place: string) => ({
    symbol,
    network,
    name: `${label} (${place})`,
    decimals,
});
const usdt = coin("USDT", "Tether USD", 6);
const usdc = coin("USDC", "USD Coin", 6);
const eth = coin("ETH", "Ethereum", 18);

export const BUYABLE_ASSETS = [
    usdt("TRC20", "TRC20"),
    usdt("BEP20", "BEP20"),
    usdt("ERC20", "ERC20"),
    usdt("POLYGON", "Polygon"),
    usdt("ARBITRUM", "Arbitrum"),
    usdt("OPTIMISM", "Optimism"),
    usdt("AVAXC", "Avalanche C-Chain"),
    usdt("SOLANA", "Solana"),
    usdt("TON", "TON"),
    usdc("ERC20", "ERC20"),
    usdc("POLYGON", "Polygon"),
    usdc("ARBITRUM", "Arbitrum"),
    usdc("OPTIMISM", "Optimism"),
    usdc("BASE", "Base"),
    usdc("AVAXC", "Avalanche C-Chain"),
    usdc("SOLANA", "Solana"),
    eth("ETHEREUM", "Ethereum"),
    eth("BEP20", "BEP20"),
    eth("ARBITRUM", "Arbitrum"),
    eth("OPTIMISM", "Optimism"),
    eth("BASE", "Base"),
] as const;

/**
 * Each provider's network ids → ours. The only place a provider's chain names
 * meet ours; an id not listed is skipped (and logged), never guessed.
 */
export const PROVIDER_NETWORK_ALIASES: Record<string, Record<string, string>> = {
    kucoin: {
        trx: "TRC20",
        bsc: "BEP20",
        eth: "ERC20",
        matic: "POLYGON",
        arbitrum: "ARBITRUM",
        optimism: "OPTIMISM",
        base: "BASE",
        avaxc: "AVAXC",
        sol: "SOLANA",
        ton: "TON",
    },
    fakesend: { trx: "TRC20", bsc: "BEP20", eth: "ERC20", sol: "SOLANA", base: "BASE" },
};

/**
 * Where a coin's own name for a network differs: ETH on Ethereum mainnet is
 * "ETHEREUM" (the row selling already uses), not the token label "ERC20".
 */
const SYMBOL_NETWORK_OVERRIDES: Record<string, string> = { "ETH:ERC20": "ETHEREUM" };

/** Our network name for a provider's coin + chain, or null when we don't map it. */
export const ourNetwork = ({ provider, symbol, providerNetwork }: { provider: string; symbol: string; providerNetwork: string }) => {
    const network = PROVIDER_NETWORK_ALIASES[provider]?.[providerNetwork];
    if (!network) return null;
    return SYMBOL_NETWORK_OVERRIDES[`${symbol}:${network}`] ?? network;
};
