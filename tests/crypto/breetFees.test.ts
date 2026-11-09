import Decimal from "decimal.js";
import resolveBreetPlatformFee from "@/services/crypto/providers/breet/resolveBreetPlatformFee";
import calculateBreetQuote from "@/services/crypto/providers/breet/calculateBreetQuote";

// The exact shape Breet's sandbox /users/fetch-integration returns.
const TIERS = [
    { min: 0, max: 999, rate: 0.5 },
    { min: 1000, max: 4999, rate: 1 },
    { min: 5000, max: Number.MAX_SAFE_INTEGER, rate: 2 },
];
const fee = (usd: string, platformFee: unknown) =>
    resolveBreetPlatformFee({ fee: platformFee as never, usdAmount: new Decimal(usd) }).toString();

describe("Breet platform fee", () => {
    it.each([
        ["0", "0.5"],
        ["999", "0.5"],
        ["999.50", "0.5"], // the gap between bands stays in the lower band
        ["1000", "1"],
        ["4999.99", "1"],
        ["5000", "2"],
    ])("a $%s trade pays %s%%", (usd, expected) => {
        expect(fee(usd, TIERS)).toBe(expected);
    });

    it("still accepts a flat percent", () => {
        expect(fee("50", 1.5)).toBe("1.5");
        expect(fee("50", "0.75")).toBe("0.75");
    });

    it.each([
        ["missing", undefined],
        ["empty tiers", []],
        ["junk rate", [{ min: 0, max: 10, rate: "abc" }]],
        ["100% or more", 100],
        ["negative", -1],
    ])("refuses to quote when the fee is %s", (_label, platformFee) => {
        expect(() => fee("10", platformFee)).toThrow(/platform fee/);
    });
});

describe("calculateBreetQuote with tiers", () => {
    it("prices the sandbox BTC rate after the 0.5% band, rounded down", () => {
        // 0.0001 BTC ÷ 0.0000133183… BTC/$ = $7.5084… × ₦1390 = ₦10,436.71; less 0.5% = ₦10,384.52.
        const quote = calculateBreetQuote({
            quote: { NGNAmount: 1390, rate: 1390, cryptoAmount: 0.000013318378324902346 },
            cryptoAmount: "0.0001",
            platformFee: TIERS,
        });
        expect(quote).toEqual({ grossNgn: "10384.52", rateNgnPerUsd: "1390" });
    });
});
