import { createHash } from "crypto";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const base58Decode = (text: string) => {
    let value = BigInt(0);
    for (const char of text) {
        const digit = BASE58.indexOf(char);
        if (digit < 0) return null;
        value = value * BigInt(58) + BigInt(digit);
    }
    const hex = value.toString(16);
    const bytes = Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex");
    const leadingZeros = text.length - text.replace(/^1+/, "").length;
    return Buffer.concat([Buffer.alloc(leadingZeros), bytes]);
};

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest();

/** TRON: base58check of 0x41 + 20 bytes, with a 4-byte double-SHA256 checksum. */
const isTronAddress = (address: string) => {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
    const bytes = base58Decode(address);
    if (!bytes || bytes.length !== 25 || bytes[0] !== 0x41) return false;
    const checksum = sha256(sha256(bytes.subarray(0, 21))).subarray(0, 4);
    return checksum.equals(bytes.subarray(21));
};

/**
 * EVM (BEP20/ERC20): 0x + 40 hex. Mixed-case (EIP-55) checksums need Keccak,
 * which Node doesn't ship — format only. The user confirms the address on the
 * confirm sheet before the PIN.
 */
const isEvmAddress = (address: string) => /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/.test(address);

/** Our network names (crypto_assets.network) → their address check. Unlisted networks can't be bought. */
const VALIDATORS: Record<string, (address: string) => boolean> = {
    TRC20: isTronAddress,
    BEP20: isEvmAddress,
    ERC20: isEvmAddress,
};

/** True when `address` is well-formed for OUR network name. Unknown networks → false. */
const isValidCryptoAddress = ({ network, address }: { network: string; address: string }) => {
    const validate = VALIDATORS[network];
    return Boolean(validate && validate(address.trim()));
};

export default isValidCryptoAddress;
