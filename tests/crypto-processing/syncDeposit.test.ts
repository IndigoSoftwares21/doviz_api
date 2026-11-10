import syncDeposit from "@/actions/deposit/syncDeposit";
import providerRegistry from "@/services/crypto/providerRegistry";
import createDepositCredit from "@/actions/depositCredit/createDepositCredit";
import selectWalletForDeposit from "@/actions/deposit/syncDeposit/queries/selectWalletForDeposit";
import insertDepositIfMissing from "@/actions/deposit/syncDeposit/queries/insertDepositIfMissing";
import selectDepositForUpdate from "@/actions/deposit/syncDeposit/queries/selectDepositForUpdate";
import updateDepositProgress from "@/actions/deposit/syncDeposit/queries/updateDepositProgress";
import { depositRecord, makeFakeProvider } from "./fakeProvider";

jest.mock("@/database", () => ({ withTransaction: (callback: (trx: unknown) => unknown) => callback({}) }));
jest.mock("@/actions/depositCredit/createDepositCredit");
jest.mock("@/actions/deposit/syncDeposit/queries/selectWalletForDeposit");
jest.mock("@/actions/deposit/syncDeposit/queries/insertDepositIfMissing");
jest.mock("@/actions/deposit/syncDeposit/queries/selectDepositForUpdate");
jest.mock("@/actions/deposit/syncDeposit/queries/updateDepositProgress");

const wallet = { walletId: "w-1", userId: "u-1", assetId: "a-1", symbol: "USDT", decimals: 6 };
const args = { provider: "fakepay", reference: "trade-1" };

describe("syncDeposit", () => {
    let provider: ReturnType<typeof makeFakeProvider>;
    const deposit = (status: string, lastEventAt: Date | null = null, subStatus: string | null = null) =>
        jest.mocked(selectDepositForUpdate).mockResolvedValue({ id: "d-1", status, subStatus, lastEventAt });

    beforeEach(() => {
        jest.resetAllMocks();
        providerRegistry.reset();
        provider = makeFakeProvider({ getDeposit: jest.fn().mockResolvedValue(depositRecord()) });
        providerRegistry.register(provider);
        jest.mocked(selectWalletForDeposit).mockResolvedValue(wallet);
    });

    it("re-fetches the provider's record and credits a completed deposit", async () => {
        deposit("pending");
        const { data } = await syncDeposit(args);
        expect(provider.getDeposit).toHaveBeenCalledWith({ reference: "trade-1" });
        expect(data.outcome).toBe("credited");
        expect(createDepositCredit).toHaveBeenCalledTimes(1);
    });

    it("flags a deposit settled in another currency once, never credits it, then leaves it alone", async () => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.mocked(provider.getDeposit).mockResolvedValue(depositRecord({ grossNgn: null, reportedUsd: "20" }));
        deposit("pending");

        const first = await syncDeposit(args);
        expect(first.data.outcome).toBe("updated");
        expect(createDepositCredit).not.toHaveBeenCalled();
        expect(updateDepositProgress).toHaveBeenCalledWith(expect.objectContaining({ record: expect.objectContaining({ status: "flagged", subStatus: "not_settled_in_ngn" }) }));

        deposit("flagged", null, "not_settled_in_ngn");
        const again = await syncDeposit(args);
        expect(again.data.outcome).toBe("unchanged");
        expect(updateDepositProgress).toHaveBeenCalledTimes(1);
    });

    it("never credits twice: an already completed deposit is a no-op", async () => {
        deposit("completed");
        const { data } = await syncDeposit(args);
        expect(data.outcome).toBe("unchanged");
        expect(createDepositCredit).not.toHaveBeenCalled();
    });

    it("ignores deposits to addresses that aren't ours", async () => {
        jest.mocked(selectWalletForDeposit).mockResolvedValue(undefined);
        const { data } = await syncDeposit(args);
        expect(data.outcome).toBe("ignored");
        expect(insertDepositIfMissing).not.toHaveBeenCalled();
    });

    it("ignores stale events", async () => {
        deposit("pending", new Date("2026-11-09T13:00:00Z"));
        const { data } = await syncDeposit(args);
        expect(data.outcome).toBe("unchanged");
        expect(createDepositCredit).not.toHaveBeenCalled();
    });

    it("updates a flagged deposit without crediting", async () => {
        jest.mocked(provider.getDeposit).mockResolvedValue(depositRecord({ status: "flagged", subStatus: "flagged" }));
        deposit("pending");
        const { data } = await syncDeposit(args);
        expect(data.outcome).toBe("updated");
        expect(updateDepositProgress).toHaveBeenCalled();
        expect(createDepositCredit).not.toHaveBeenCalled();
    });

    it("leaves a deleted deposit alone", async () => {
        deposit("deleted");
        const { data } = await syncDeposit(args);
        expect(data.outcome).toBe("unchanged");
    });

    it("refuses amounts with more precision than the coin allows", async () => {
        jest.mocked(provider.getDeposit).mockResolvedValue(depositRecord({ cryptoAmount: "1.1234567" }));
        await expect(syncDeposit(args)).rejects.toThrow(/precision/);
        expect(insertDepositIfMissing).not.toHaveBeenCalled();
    });

    it("throws (retry later) when the provider has no record", async () => {
        jest.mocked(provider.getDeposit).mockResolvedValue(null);
        await expect(syncDeposit(args)).rejects.toThrow(/not found/);
    });
});
