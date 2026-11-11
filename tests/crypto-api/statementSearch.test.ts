import buildStatementSearch from "@/utils/wallet/buildStatementSearch";
import { BILL_CATEGORY } from "@/constants/bills";
import { LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

describe("buildStatementSearch", () => {
    it("maps everyday words to the kind of transaction", () => {
        expect(buildStatementSearch({ q: "airtime" }).billCategories).toEqual([BILL_CATEGORY.AIRTIME]);
        expect(buildStatementSearch({ q: "light bill" }).billCategories).toEqual([BILL_CATEGORY.ELECTRICITY]);
        expect(buildStatementSearch({ q: "elec" }).billCategories).toEqual([BILL_CATEGORY.ELECTRICITY]);
        expect(buildStatementSearch({ q: "refund" }).ledgerTypes).toContain(LEDGER_TRANSACTION_TYPE.BILL_REVERSAL);
        expect(buildStatementSearch({ q: "withdraw" }).ledgerTypes).toContain(LEDGER_TRANSACTION_TYPE.WITHDRAWAL_HOLD);
    });

    it("ignores words too short to mean anything", () => {
        const search = buildStatementSearch({ q: "da" });
        expect(search.billCategories).toEqual([]);
        expect(search.ledgerTypes).toEqual([]);
    });

    it("reads amounts with ₦, commas and kobo", () => {
        expect(buildStatementSearch({ q: "₦1,000" }).amount).toBe("1000.00");
        expect(buildStatementSearch({ q: "250.5" }).amount).toBe("250.50");
        expect(buildStatementSearch({ q: "MTN" }).amount).toBeNull();
    });

    it("finds phone / meter fragments and reference prefixes", () => {
        expect(buildStatementSearch({ q: "0906 365" }).customerContains).toBe("%0906365%");
        expect(buildStatementSearch({ q: "30686e14" }).referencePrefix).toBe("30686e14%");
        expect(buildStatementSearch({ q: "abc" }).referencePrefix).toBeNull(); // too short
    });

    it("treats % and _ literally", () => {
        expect(buildStatementSearch({ q: "50%_off" }).contains).toBe("%50\\%\\_off%");
    });
});
