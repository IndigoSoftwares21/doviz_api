import BREET from "./constants";

/**
 * Breet's `network` is the CHAIN ("Ethereum", "Arbitrum", "Tron"); `type` is
 * only the token standard ("ERC20" is used on every EVM chain) or
 * BASE_ASSET for the chain's own coin. So the chain decides:
 *   token on Ethereum → ERC20, token on Tron → TRC20,
 *   native Bitcoin → BITCOIN, native Ethereum → ETHEREUM.
 * Anything else becomes its upper-cased chain (ARBITRUM, POLYGON…), so an
 * L2 or sidechain can never pass for one of ours — a wrong-chain address
 * would lose the user's funds. A missing type fails closed (no match).
 */
const mapBreetNetwork = ({ network, type }: { network?: string; type?: string }) => {
    const chain = (network ?? "").trim().toLowerCase();
    const kind = (type ?? "").trim().toUpperCase();
    const isNative = kind === BREET.NATIVE_ASSET_TYPE;
    const isToken = kind !== "" && !isNative;
    const isEthereum = chain === "ethereum" || chain.startsWith("ethereum_");

    if (isToken && isEthereum) return "ERC20";
    if (isToken && chain === "tron") return "TRC20";
    if (isNative && chain === "bitcoin") return "BITCOIN";
    if (isNative && isEthereum) return "ETHEREUM";
    return (network ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
};

export default mapBreetNetwork;
