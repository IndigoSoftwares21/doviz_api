import isEvmAddress from "./evm";
import isSolanaAddress from "./solana";
import isTonAddress from "./ton";
import isTronAddress from "./tron";

/** Our network names (crypto_assets.network) → their address check. Unlisted networks can't be bought. */
const VALIDATORS: Record<string, (address: string) => boolean> = {
    TRC20: isTronAddress,
    BEP20: isEvmAddress,
    ERC20: isEvmAddress,
    ETHEREUM: isEvmAddress,
    POLYGON: isEvmAddress,
    ARBITRUM: isEvmAddress,
    OPTIMISM: isEvmAddress,
    BASE: isEvmAddress,
    AVAXC: isEvmAddress,
    SOLANA: isSolanaAddress,
    TON: isTonAddress,
};

/** True when `address` is well-formed for OUR network name. Unknown networks → false. */
const isValidCryptoAddress = ({ network, address }: { network: string; address: string }) => {
    const validate = VALIDATORS[network];
    return Boolean(validate && validate(address.trim()));
};

export const BUYABLE_NETWORKS = Object.keys(VALIDATORS);

export default isValidCryptoAddress;
