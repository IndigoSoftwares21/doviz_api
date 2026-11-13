import fetchNairaFundingOptions from "@/actions/nairaFunding/fetchNairaFundingOptions";
import selectNairaFundingProvider from "@/actions/nairaFunding/fetchNairaFundingOptions/queries/selectNairaFundingProvider";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/nairaFunding/fetchNairaFundingOptions/queries/selectNairaFundingProvider");

describe("Add money flow switch", () => {
    it.each([
        ["squad", "account_number"],
        ["korapay", "bank_transfer"],
    ])("%s → %s", async (provider, mode) => {
        jest.mocked(selectNairaFundingProvider).mockResolvedValue({ activeProvider: provider });
        await expect(fetchNairaFundingOptions()).resolves.toEqual({ data: { mode } });
    });

    it.each([[null], [{ activeProvider: "someone-new" }]])("falls back to the account-number flow, never the old one (%#)", async (setting) => {
        jest.mocked(selectNairaFundingProvider).mockResolvedValue(setting);
        await expect(fetchNairaFundingOptions()).resolves.toEqual({ data: { mode: "account_number" } });
    });
});
