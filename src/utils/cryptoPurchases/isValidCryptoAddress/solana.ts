import base58Decode from "./base58";

/**
 * Solana: a 32-byte public key in base58 (32–44 characters). Anything that
 * doesn't decode to exactly 32 bytes isn't a Solana address. The all-zero key
 * (the system program, "1111…") can't receive.
 */
const isSolanaAddress = (address: string) => {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
    const bytes = base58Decode(address);
    return Boolean(bytes && bytes.length === 32 && bytes.some((byte) => byte !== 0));
};

export default isSolanaAddress;
