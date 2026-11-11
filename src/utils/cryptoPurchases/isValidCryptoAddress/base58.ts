const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Bitcoin-alphabet base58 → bytes (leading "1"s are zero bytes). null on a bad character. */
const base58Decode = (text: string) => {
    let value = BigInt(0);
    for (const char of text) {
        const digit = BASE58.indexOf(char);
        if (digit < 0) return null;
        value = value * BigInt(58) + BigInt(digit);
    }
    const hex = value === BigInt(0) ? "" : value.toString(16);
    const bytes = Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex");
    const leadingZeros = text.length - text.replace(/^1+/, "").length;
    return Buffer.concat([Buffer.alloc(leadingZeros), bytes]);
};

export default base58Decode;
