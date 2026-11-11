import isFreshQuoteAcceptable from "@/utils/cryptoPurchases/isFreshQuoteAcceptable";

const check = (expectedCryptoAmount: string | null, fresh: { total: string; cryptoAmount: string }, expectedTotal = "50000.00") =>
    isFreshQuoteAcceptable({ expectedTotal, expectedCryptoAmount, fresh });

describe("buying at a price that moved since the quote", () => {
    it("never charges more than the confirmed total", () => {
        expect(check("0.01700000", { total: "50000.01", cryptoAmount: "0.01800000" })).toBe(false);
    });

    it("the same or more coin for no more naira goes ahead", () => {
        expect(check("0.01700000", { total: "50000.00", cryptoAmount: "0.01700000" })).toBe(true);
        expect(check("0.01700000", { total: "49999.98", cryptoAmount: "0.01710000" })).toBe(true);
    });

    it("up to 0.5% less coin is accepted; more than that needs a new confirm", () => {
        expect(check("0.01700000", { total: "50000.00", cryptoAmount: "0.01691500" })).toBe(true); // exactly −0.5%
        expect(check("0.01700000", { total: "50000.00", cryptoAmount: "0.01691499" })).toBe(false);
    });

    it("older apps (no expectedCryptoAmount): the total must match exactly, as before", () => {
        expect(check(null, { total: "50000.00", cryptoAmount: "1" })).toBe(true);
        expect(check(null, { total: "49999.99", cryptoAmount: "1" })).toBe(false);
    });
});
