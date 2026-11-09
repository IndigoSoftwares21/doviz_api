import accountNameMatches from "@/utils/names/accountNameMatches";
import maskAccountNumber from "@/utils/banks/maskAccountNumber";
import isCryptoAmount from "@/utils/money/isCryptoAmount";
import calculateMarkup from "@/utils/money/calculateMarkup";
import getCachedValue from "@/utils/crypto/getCachedValue";

const ada = { firstName: "Adaeze", lastName: "Okafor" };

describe("accountNameMatches", () => {
    it.each(["OKAFOR ADAEZE CHIOMA", "Adaeze Okafor", "ADAEZE C. OKAFOR", "okafor, adaeze"])("matches %j", (accountName) => {
        expect(accountNameMatches({ accountName, ...ada })).toBe(true);
    });

    it.each(["ADA OKAFOR", "ADAEZE NWOSU", "OKAFOR", "OKAFORADAEZE"])("rejects %j", (accountName) => {
        expect(accountNameMatches({ accountName, ...ada })).toBe(false);
    });

    it("ignores accents, apostrophes and hyphens", () => {
        expect(accountNameMatches({ accountName: "ADESOLA ONEIL EZE", firstName: "Adéṣọlá", lastName: "O'Neil-Eze" })).toBe(true);
    });

    it("never matches an empty legal name", () => {
        expect(accountNameMatches({ accountName: "ANYONE", firstName: "", lastName: "" })).toBe(false);
    });
});

describe("money helpers", () => {
    it("masks account numbers", () => {
        expect(maskAccountNumber({ accountNumber: "0123456789" })).toBe("******6789");
    });

    it.each([
        ["100", 6, true], ["0.000001", 6, true], ["0.0000001", 6, false], ["0", 6, false],
        ["-1", 6, false], ["1e3", 6, false], ["01", 6, false], ["5", 0, true], ["5.5", 0, false],
    ])("isCryptoAmount(%j, %i) = %s", (value, decimals, expected) => {
        expect(isCryptoAmount({ value: value as string, decimals: decimals as number })).toBe(expected);
    });

    it("rounds the markup DOWN to the kobo so net = gross − markup exactly", () => {
        expect(calculateMarkup({ grossNgn: "160000", markupPercent: "2.5" })).toEqual({ markupNgn: "4000.00", netNgn: "156000.00" });
        expect(calculateMarkup({ grossNgn: "100.01", markupPercent: "2.5" })).toEqual({ markupNgn: "2.50", netNgn: "97.51" });
        expect(calculateMarkup({ grossNgn: "0.03", markupPercent: "2.5" })).toEqual({ markupNgn: "0.00", netNgn: "0.03" });
    });
});

describe("getCachedValue", () => {
    it("loads once within the TTL and does not cache failures", async () => {
        const load = jest.fn().mockResolvedValue("v");
        await getCachedValue({ key: "k1", ttlSeconds: 60, load });
        const second = await getCachedValue({ key: "k1", ttlSeconds: 60, load });
        expect(second.value).toBe("v");
        expect(load).toHaveBeenCalledTimes(1);

        const failing = jest.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("ok");
        await expect(getCachedValue({ key: "k2", ttlSeconds: 60, load: failing })).rejects.toThrow("down");
        await expect(getCachedValue({ key: "k2", ttlSeconds: 60, load: failing })).resolves.toMatchObject({ value: "ok" });
    });
});
