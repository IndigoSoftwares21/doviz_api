/** The coins Doviz accepts. Provider assets are matched onto these by symbol + network. */
const SUPPORTED_ASSETS = [
    { symbol: "USDT", network: "TRC20", name: "Tether USD (TRC20)", decimals: 6 },
    { symbol: "USDC", network: "ERC20", name: "USD Coin (ERC20)", decimals: 6 },
    { symbol: "BTC", network: "BITCOIN", name: "Bitcoin", decimals: 8 },
    { symbol: "ETH", network: "ETHEREUM", name: "Ethereum", decimals: 18 },
] as const;

export default SUPPORTED_ASSETS;
