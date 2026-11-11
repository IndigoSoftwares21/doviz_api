/** CRC16-XMODEM (poly 0x1021, init 0), as TON uses for its user-friendly addresses. */
const crc16 = (data: Buffer) => {
    let crc = 0;
    for (const byte of data) {
        crc ^= byte << 8;
        for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
};

const BOUNCEABLE = 0x11;
const NON_BOUNCEABLE = 0x51;
const TESTNET_FLAG = 0x80;

/** "EQ…"/"UQ…": 48 base64(url) chars → flag, workchain, 32-byte hash, CRC16 of the first 34 bytes. */
const isFriendlyTonAddress = (address: string) => {
    if (!/^[A-Za-z0-9+/_-]{48}$/.test(address)) return false;
    const bytes = Buffer.from(address.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (bytes.length !== 36) return false;
    const flag = bytes[0];
    if (flag & TESTNET_FLAG) return false; // a testnet address: real coins sent there are lost
    if (flag !== BOUNCEABLE && flag !== NON_BOUNCEABLE) return false;
    if (bytes[1] !== 0x00 && bytes[1] !== 0xff) return false; // basechain (0) or masterchain (-1)
    return crc16(bytes.subarray(0, 34)) === bytes.readUInt16BE(34);
};

/** TON: raw "0:<64 hex>" (or masterchain "-1:…"), or the user-friendly form with its checksum. */
const isTonAddress = (address: string) => /^(0|-1):[0-9a-fA-F]{64}$/.test(address) || isFriendlyTonAddress(address);

export default isTonAddress;
