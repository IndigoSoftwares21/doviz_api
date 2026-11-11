import estimatePayoutFee from "@/actions/withdrawalQuote/fetchWithdrawalQuote/utils/estimatePayoutFee";
import selectHighestRecentFee from "@/actions/withdrawalQuote/fetchWithdrawalQuote/queries/selectHighestRecentFee";
import selectPayoutFeeDefault from "@/actions/withdrawalQuote/fetchWithdrawalQuote/queries/selectPayoutFeeDefault";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/withdrawalQuote/fetchWithdrawalQuote/queries/selectHighestRecentFee");
jest.mock("@/actions/withdrawalQuote/fetchWithdrawalQuote/queries/selectPayoutFeeDefault");

const estimate = () => estimatePayoutFee({ provider: "korapay", environment: "production", currency: "NGN" });

describe("estimatePayoutFee", () => {
    beforeEach(() => jest.resetAllMocks());

    it("uses the configured default (fixed + VAT) when there's no history yet", async () => {
        jest.mocked(selectHighestRecentFee).mockResolvedValue({ highestFee: null });
        jest.mocked(selectPayoutFeeDefault).mockResolvedValue({ fixedFee: "50.00", vatPercent: "7.50" });
        await expect(estimate()).resolves.toBe("53.75");
    });

    it("takes a higher real fee from history (a price rise is caught at once)", async () => {
        jest.mocked(selectHighestRecentFee).mockResolvedValue({ highestFee: "64.50" });
        jest.mocked(selectPayoutFeeDefault).mockResolvedValue({ fixedFee: "50.00", vatPercent: "7.50" });
        await expect(estimate()).resolves.toBe("64.50");
    });

    it("never reserves less than the default, and rounds VAT up to the kobo", async () => {
        jest.mocked(selectHighestRecentFee).mockResolvedValue({ highestFee: "10.75" });
        jest.mocked(selectPayoutFeeDefault).mockResolvedValue({ fixedFee: "25.00", vatPercent: "7.50" });
        await expect(estimate()).resolves.toBe("26.88"); // 26.875 → up
    });

    it("falls back to history alone, then to zero, when no default is configured", async () => {
        jest.mocked(selectPayoutFeeDefault).mockResolvedValue(undefined);
        jest.mocked(selectHighestRecentFee).mockResolvedValue({ highestFee: "32.25" });
        await expect(estimate()).resolves.toBe("32.25");
        jest.mocked(selectHighestRecentFee).mockResolvedValue({ highestFee: null });
        await expect(estimate()).resolves.toBe("0.00");
    });
});
