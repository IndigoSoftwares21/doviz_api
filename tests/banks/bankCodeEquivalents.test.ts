import BANK_CODE_EQUIVALENTS, { equivalentBankCodes } from "@/constants/bankCodeEquivalents";

describe("bank code equivalents", () => {
    it.each([
        ["058", ["058", "000013"]],
        ["000013", ["058", "000013"]],
        ["305", ["305", "100004"]],
        ["090267", ["50211", "090267"]],
        ["999999", ["999999"]],
    ])("%s is the same bank as %j", (code, expected) => {
        expect([...equivalentBankCodes(code)]).toEqual(expected);
    });

    it("never puts one code in two banks", () => {
        const codes = BANK_CODE_EQUIVALENTS.flat();
        expect(new Set(codes).size).toBe(codes.length);
    });
});
