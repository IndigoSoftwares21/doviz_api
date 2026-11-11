import { createHash } from "crypto";
import base58Decode from "./base58";

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest();

/** TRON: base58check of 0x41 + 20 bytes, with a 4-byte double-SHA256 checksum. */
const isTronAddress = (address: string) => {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
    const bytes = base58Decode(address);
    if (!bytes || bytes.length !== 25 || bytes[0] !== 0x41) return false;
    const checksum = sha256(sha256(bytes.subarray(0, 21))).subarray(0, 4);
    return checksum.equals(bytes.subarray(21));
};

export default isTronAddress;
