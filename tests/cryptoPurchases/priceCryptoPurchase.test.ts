import priceCryptoPurchase from "@/utils/cryptoPurchases/priceCryptoPurchase";
import isValidCryptoAddress from "@/utils/cryptoPurchases/isValidCryptoAddress";

describe("priceCryptoPurchase", () => {
    const base = { rate: "1500", markupPercent: "0", networkFee: "1", precision: 6 };

    it("prices a coin amount: the fee is priced in, so the user receives exactly what they asked for", () => {
        expect(priceCryptoPurchase({ ...base, cryptoAmount: "10" })).toEqual({
            unitPrice: "1500.00", cryptoAmount: "10", networkFee: "1", nairaAmount: "15000.00", nairaFee: "1500.00", total: "16500.00",
        });
    });

    it("prices a naira budget: buys as much as fits after the fee, never spending more than the budget", () => {
        const price = priceCryptoPurchase({ ...base, nairaTotal: "16500.00" })!;
        expect(price.cryptoAmount).toBe("10");
        expect(price.total).toBe("16500.00");

        const odd = priceCryptoPurchase({ ...base, nairaTotal: "10000.00" })!;
        expect(odd.cryptoAmount).toBe("5.666666"); // rounded DOWN to the provider's precision
        expect(Number(odd.total)).toBeLessThanOrEqual(10000);
    });

    it("applies the markup and always rounds in our favour by at most a kobo", () => {
        const price = priceCryptoPurchase({ ...base, rate: "1650.333", markupPercent: "1.5", cryptoAmount: "3.333333" })!;
        expect(price.unitPrice).toBe("1675.09"); // 1675.088… rounded UP
        expect(price.nairaAmount).toBe("5583.64"); // 5583.6327… rounded UP
    });

    it("returns null when the budget doesn't even cover the fee", () => {
        expect(priceCryptoPurchase({ ...base, nairaTotal: "1000.00" })).toBeNull();
    });
});

describe("isValidCryptoAddress", () => {
    it("checks TRON addresses with their checksum", () => {
        expect(isValidCryptoAddress({ network: "TRC20", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" })).toBe(true);
        expect(isValidCryptoAddress({ network: "TRC20", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X" })).toBe(false); // one char off
        expect(isValidCryptoAddress({ network: "TRC20", address: "0x52908400098527886E0F7030069857D2E4169EE7" })).toBe(false);
    });

    it("checks EVM address format on BEP20/ERC20, and refuses networks we can't check", () => {
        expect(isValidCryptoAddress({ network: "BEP20", address: "0x52908400098527886E0F7030069857D2E4169EE7" })).toBe(true);
        expect(isValidCryptoAddress({ network: "BEP20", address: "0x0000000000000000000000000000000000000000" })).toBe(false);
        expect(isValidCryptoAddress({ network: "BEP20", address: "0x5290840009852788" })).toBe(false);
        expect(isValidCryptoAddress({ network: "BITCOIN", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" })).toBe(false);
    });
});
