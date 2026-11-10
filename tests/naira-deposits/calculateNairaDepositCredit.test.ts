import calculateNairaDepositCredit from "@/utils/nairaDeposits/calculateNairaDepositCredit";

describe("calculateNairaDepositCredit", () => {
    it("credits what reached Doviz when the user bears the fee", () => {
        expect(calculateNairaDepositCredit({ amountReceived: "50375.00", providerFee: "375.00", feeBearer: "user" })).toEqual({
            amountCredited: "50000.00",
            settled: "50000.00",
            absorbedFee: "0.00",
        });
    });

    it("credits everything received when Doviz bears the fee, and records what it absorbed", () => {
        expect(calculateNairaDepositCredit({ amountReceived: "50000.00", providerFee: "375.00", feeBearer: "doviz" })).toEqual({
            amountCredited: "50000.00",
            settled: "49625.00",
            absorbedFee: "375.00",
        });
    });

    it("balances: credited = settled + absorbed", () => {
        for (const feeBearer of ["user", "doviz"] as const) {
            const { amountCredited, settled, absorbedFee } = calculateNairaDepositCredit({ amountReceived: "1234.56", providerFee: "12.35", feeBearer });
            expect(Number(settled) + Number(absorbedFee)).toBeCloseTo(Number(amountCredited), 2);
        }
    });

    it("refuses a fee that eats the whole transfer", () => {
        expect(() => calculateNairaDepositCredit({ amountReceived: "100.00", providerFee: "100.00", feeBearer: "user" })).toThrow();
    });
});
