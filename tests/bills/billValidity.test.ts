import parseFlutterwaveValidity from "@/services/bills/providers/flutterwave/parseFlutterwaveValidity";
import billValidityGroup from "@/utils/bills/billValidityGroup";

describe("parseFlutterwaveValidity", () => {
    it.each([
        ["30s", 30],
        ["7s", 7],
        ["2s", 2],
        ["1s", 1],
        ["90s", 90],
        ["30", 30],
        [30, 30],
        [null, null],
        [undefined, null],
        ["", null],
        ["monthly", null],
        ["0s", null],
    ])("%p → %p", (value, days) => {
        expect(parseFlutterwaveValidity({ value: value as string | number | null | undefined })).toBe(days);
    });
});

describe("billValidityGroup", () => {
    it.each([
        [1, "daily"],
        [2, "daily"],
        [3, "weekly"],
        [7, "weekly"],
        [14, "weekly"],
        [30, "monthly"],
        [45, "monthly"],
        [60, "quarterly"],
        [90, "quarterly"],
        [365, "long_term"],
        [null, "other"],
    ])("%p days → %s", (validityDays, group) => {
        expect(billValidityGroup({ validityDays })).toBe(group);
    });
});
