import isValidCryptoAddress from "@/utils/cryptoPurchases/isValidCryptoAddress";

const valid = (network: string, address: string) => isValidCryptoAddress({ network, address });

/** Real mainnet addresses: Tether/Circle token contracts as KuCoin lists them. */
const TON_USDT = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const SOL_USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const EVM = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

describe("buy address checks per network", () => {
    it.each(["ERC20", "BEP20", "ETHEREUM", "POLYGON", "ARBITRUM", "OPTIMISM", "BASE", "AVAXC"])("%s takes a 0x address", (network) => {
        expect(valid(network, EVM)).toBe(true);
        expect(valid(network, "0x0000000000000000000000000000000000000000")).toBe(false);
        expect(valid(network, "0x833589fcd6edb6e08f4c7c32d4f71b54bda0291")).toBe(false);
        expect(valid(network, SOL_USDT)).toBe(false);
    });

    it("Solana: base58 that decodes to exactly 32 bytes", () => {
        expect(valid("SOLANA", SOL_USDT)).toBe(true);
        expect(valid("SOLANA", SOL_USDC)).toBe(true);
        expect(valid("SOLANA", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false); // TRON: 25 bytes
        expect(valid("SOLANA", `${SOL_USDT.slice(0, -1)}0`)).toBe(false); // 0 isn't base58
        expect(valid("SOLANA", "11111111111111111111111111111111")).toBe(false); // the system program
        expect(valid("SOLANA", EVM)).toBe(false);
    });

    it("TON: user-friendly form with a matching CRC16, or raw 0:<hex>", () => {
        expect(valid("TON", TON_USDT)).toBe(true);
        expect(valid("TON", TON_USDT.replace(/-/g, "+").replace(/_/g, "/"))).toBe(true); // plain base64 too
        expect(valid("TON", `${TON_USDT.slice(0, -1)}t`)).toBe(false); // checksum broken
        expect(valid("TON", `EQ${TON_USDT.slice(3)}`)).toBe(false); // too short
        expect(valid("TON", `0:${"b1".repeat(32)}`)).toBe(true);
        expect(valid("TON", `0:${"b1".repeat(31)}`)).toBe(false);
        expect(valid("TON", EVM)).toBe(false);
    });

    /** Re-flags the address and writes a correct CRC16-XMODEM, as a wallet would. */
    const withFlag = (flag: number) => {
        const bytes = Buffer.from(TON_USDT.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        bytes[0] = flag;
        let crc = 0;
        for (const byte of bytes.subarray(0, 34)) {
            crc ^= byte << 8;
            for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
        }
        bytes.writeUInt16BE(crc, 34);
        return bytes.toString("base64url");
    };

    it("TON: the non-bounceable UQ… form is fine; a testnet address (valid checksum) is refused", () => {
        expect(withFlag(0x11)).toBe(TON_USDT); // same CRC as the real one: the helper is right
        expect(valid("TON", withFlag(0x51))).toBe(true);
        expect(withFlag(0x51).startsWith("UQ")).toBe(true);
        expect(valid("TON", withFlag(0x91))).toBe(false);
        expect(valid("TON", withFlag(0xd1))).toBe(false);
    });

    it("TRON stays strict, and unknown networks are never buyable", () => {
        expect(valid("TRC20", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true);
        expect(valid("TRC20", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u")).toBe(false);
        expect(valid("NEAR", "usdt.tether-token.near")).toBe(false);
    });
});
