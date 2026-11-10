import normalizeBillText from "@/services/bills/catalog/normalizeBillText";
import inferBillCategory from "@/services/bills/catalog/inferBillCategory";
import matchProviderBiller, { MatchableBiller } from "@/services/bills/catalog/matchProviderBiller";
import cleanBillProductName from "@/services/bills/catalog/cleanBillProductName";
import parseValidityDays from "@/services/bills/catalog/parseValidityDays";

/** A slice of the billers seeded by the migration (same keywords). */
const BILLERS: MatchableBiller[] = [
    { id: "b-mtn-air", slug: "mtn-airtime", categoryCode: "airtime", matchKeywords: ["MTN"] },
    { id: "b-mtn-data", slug: "mtn-data", categoryCode: "data", matchKeywords: ["MTN"] },
    { id: "b-airtel-air", slug: "airtel-airtime", categoryCode: "airtime", matchKeywords: ["AIRTEL"] },
    { id: "b-airtel-data", slug: "airtel-data", categoryCode: "data", matchKeywords: ["AIRTEL"] },
    { id: "b-9m-air", slug: "9mobile-airtime", categoryCode: "airtime", matchKeywords: ["9MOBILE", "ETISALAT"] },
    { id: "b-ikeja", slug: "ikeja-electric", categoryCode: "electricity", matchKeywords: ["IKEJA", "IKEDC"] },
    { id: "b-eko", slug: "eko-electric", categoryCode: "electricity", matchKeywords: ["EKO", "EKEDC"] },
    { id: "b-phed", slug: "port-harcourt-electric", categoryCode: "electricity", matchKeywords: ["PORT HARCOURT", "PHC", "PHED"] },
    { id: "b-dstv", slug: "dstv", categoryCode: "cable_tv", matchKeywords: ["DSTV"] },
    { id: "b-gotv", slug: "gotv", categoryCode: "cable_tv", matchKeywords: ["GOTV"] },
];

const suggest = (name: string, customerIdLabel: string | null = null, hint: Parameters<typeof matchProviderBiller>[0]["category"] = null) =>
    matchProviderBiller({ name, category: hint ?? inferBillCategory({ name, customerIdLabel }), billers: BILLERS });

describe("normalizeBillText", () => {
    it("uppercases, drops punctuation and collapses spaces but keeps decimals", () => {
        expect(normalizeBillText({ text: "IKEDC  PREPAID" })).toBe("IKEDC PREPAID");
        expect(normalizeBillText({ text: "ikedc-top_up (prepaid)." })).toBe("IKEDC TOP UP PREPAID");
        expect(normalizeBillText({ text: "MTN 1.5 GB" })).toBe("MTN 1.5 GB");
        expect(normalizeBillText({ text: "MTN 1.2GB+2GB Youtube" })).toBe("MTN 1.2GB+2GB YOUTUBE");
    });
});

describe("inferBillCategory", () => {
    it.each([
        ["MTN DATA BUNDLE", null, "data"],
        ["MTN VTU", null, "airtime"],
        ["IKEJA DISCO ELECTRICITY BILLS", null, "electricity"],
        ["BEDC Postpaid Payment", null, "electricity"],
        ["Some Toll Company", "Meter Number", "electricity"],
        ["DSTV", null, "cable_tv"],
        ["Some Cable Co", "SmartCard Number", "cable_tv"],
        ["SPECTRANET LIMITED", null, "internet"],
        ["FIRS PAYMENT", "Tax Identification Number (TIN)", null],
    ])("%s (label %s) → %s", (name, label, expected) => {
        expect(inferBillCategory({ name, customerIdLabel: label })).toBe(expected);
    });
});

describe("matchProviderBiller", () => {
    it("separates the same network's airtime and data by category", () => {
        expect(suggest("MTN DATA BUNDLE").billerId).toBe("b-mtn-data");
        expect(suggest("MTN NIGERIA", null, "airtime").billerId).toBe("b-mtn-air");
    });

    it("matches multi-word and alternative keywords as whole words", () => {
        expect(suggest("PORT HARCOURT DISCO ELECTRICITY BILLS").billerId).toBe("b-phed");
        expect(suggest("EKEDC PREPAID TOPUP").billerId).toBe("b-eko");
        expect(suggest("Etisalat Recharge").billerId).toBe("b-9m-air");
        // "GLOBAL" must not match a "GLO" keyword, nor "MTNX" an "MTN" one.
        expect(suggest("MTNX DATA").billerId).toBeNull();
    });

    it("leaves ambiguous and unknown billers unlinked, with the reason", () => {
        expect(suggest("MTN HYNET", "Account Number")).toEqual({ billerId: null, reason: "Ambiguous: mtn-airtime, mtn-data" });
        expect(suggest("Airtel Dealer payment", "Number").billerId).toBeNull();
        expect(suggest("DHL shipping payments")).toEqual({ billerId: null, reason: "No biller keyword in the provider name" });
    });

    it("refuses a keyword match in the wrong category", () => {
        expect(matchProviderBiller({ name: "DSTV", category: "electricity", billers: BILLERS })).toEqual({
            billerId: null,
            reason: "Keyword matches dstv, but none in category electricity",
        });
    });

    it("works for a different provider's naming with no code change", () => {
        // VTpass-style service ids / names, nothing like Flutterwave's.
        expect(suggest("mtn-data", null, "data").billerId).toBe("b-mtn-data");
        expect(suggest("ikeja-electric", null, "electricity").billerId).toBe("b-ikeja");
        expect(suggest("Ikeja Electric Payment - IKEDC").billerId).toBe("b-ikeja");
        expect(suggest("gotv").billerId).toBe("b-gotv");
        expect(suggest("dstv").billerId).toBe("b-dstv");
    });
});

describe("cleanBillProductName", () => {
    const clean = (rawName: string, category: Parameters<typeof cleanBillProductName>[0]["category"], billerKeywords: string[], amountType: "fixed" | "range" = "fixed") =>
        cleanBillProductName({ rawName, category, amountType, billerKeywords });

    it.each([
        ["AIRTEL 1.3GB data bundle", "data", ["AIRTEL"], "1.3GB"],
        ["MTN 1.5 GB", "data", ["MTN"], "1.5GB"],
        ["AIRTEL 10 MB data bundle", "data", ["AIRTEL"], "10MB"],
        ["DSTV Premium", "cable_tv", ["DSTV"], "Premium"],
        ["GOTV Light Quarterly", "cable_tv", ["GOTV"], "Light Quarterly"],
        ["SMART - One Month", "cable_tv", ["STARTIMES"], "Smart One Month"],
        ["ipNX Family Plan", "internet", ["IPNX"], "Family Plan"],
        ["Asian + HD/ExtraView", "cable_tv", ["DSTV"], "Asian + HD ExtraView"],
        ["MTN 1.2GB+2GB Youtube", "data", ["MTN"], "1.2GB+2GB Youtube"],
        ["MTN 1GB data purchase (1 day)", "data", ["MTN"], "1GB 1 day"],
        ["Box Office (New Premier Price)", "cable_tv", ["DSTV"], "Box Office New Premier Price"],
    ])("%s → %s", (raw, category, keywords, expected) => {
        expect(clean(raw, category as never, keywords)).toBe(expected);
    });

    it("names electricity by meter type", () => {
        expect(clean("IKEDC  PREPAID", "electricity", ["IKEDC"], "range")).toBe("Prepaid");
        expect(clean("BENIN DISCO ELECTRICITY BILLS (Postpaid)", "electricity", ["BENIN"], "range")).toBe("Postpaid");
        expect(clean("IKEDC TOP UP (PREPAID)", "electricity", ["IKEDC"], "range")).toBe("Prepaid");
    });

    it("names airtime and other any-amount products plainly", () => {
        expect(clean("GLO VTU", "airtime", ["GLO"], "range")).toBe("Airtime");
        expect(clean("TOP UP ACCOUNT", "internet", ["SPECTRANET"], "range")).toBe("Top-up");
    });

    it("falls back to the tidied raw name rather than returning nothing", () => {
        expect(clean("DSTV Payment", "cable_tv", ["DSTV"])).toBe("DSTV Payment");
    });
});

describe("parseValidityDays", () => {
    it.each([
        ["BASIC - One Day", 1],
        ["NOVA - One Week", 7],
        ["CLASSIC - One month", 30],
        ["GOTV Light Quarterly", 90],
        ["2GB 7 Days", 7],
        ["Weekly Plan", 7],
        ["Annual Plan", 365],
        ["MTN 1.5 GB", null],
    ])("%s → %s", (name, days) => {
        expect(parseValidityDays({ name })).toBe(days);
    });
});
