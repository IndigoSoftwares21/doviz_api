import processWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent";
import providerRegistry from "@/services/crypto/providerRegistry";
import syncDeposit from "@/actions/deposit/syncDeposit";
import syncWithdrawal from "@/actions/withdrawal/syncWithdrawal";
import selectWithdrawalIdByReference from "@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWithdrawalIdByReference";
import selectWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWebhookEvent";
import updateWebhookEventAttempt from "@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventAttempt";
import updateWebhookEventResult from "@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventResult";
import { makeFakeProvider } from "./fakeProvider";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/deposit/syncDeposit");
jest.mock("@/actions/withdrawal/syncWithdrawal");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWithdrawalIdByReference");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWebhookEvent");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventAttempt");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventResult");

const row = { id: "row-1", provider: "fakepay", payload: {}, status: "received", attempts: 0 };
const parsed = (resourceType: "deposit" | "payout" | "other") => ({
    eventId: "ev-1", eventName: "x", resourceType, resourceId: "trade-1", eventTime: null,
});

describe("processWebhookEvent", () => {
    let provider: ReturnType<typeof makeFakeProvider>;

    beforeEach(() => {
        jest.resetAllMocks();
        providerRegistry.reset();
        provider = makeFakeProvider({ parseWebhook: jest.fn().mockReturnValue(parsed("deposit")) });
        providerRegistry.register(provider);
        jest.mocked(selectWebhookEvent).mockResolvedValue(row);
        jest.mocked(updateWebhookEventAttempt).mockResolvedValue({ id: "row-1", attempts: 1 });
    });

    it("syncs the deposit the event points at", async () => {
        jest.mocked(syncDeposit).mockResolvedValue({ data: { outcome: "credited" } });
        const { data } = await processWebhookEvent({ id: "row-1" });
        expect(syncDeposit).toHaveBeenCalledWith({ provider: "fakepay", reference: "trade-1" });
        expect(data.status).toBe("processed");
        expect(updateWebhookEventResult).toHaveBeenCalledWith({ id: "row-1", status: "processed", lastError: null });
    });

    it("syncs the withdrawal a payout event points at", async () => {
        jest.mocked(provider.parseWebhook).mockReturnValue(parsed("payout"));
        jest.mocked(selectWithdrawalIdByReference).mockResolvedValue({ id: "withdrawal-1" });
        jest.mocked(syncWithdrawal).mockResolvedValue({ data: { outcome: "completed" } });

        const { data } = await processWebhookEvent({ id: "row-1" });
        expect(selectWithdrawalIdByReference).toHaveBeenCalledWith({ provider: "fakepay", reference: "trade-1" });
        expect(syncWithdrawal).toHaveBeenCalledWith({ withdrawalId: "withdrawal-1" });
        expect(data.status).toBe("processed");
        expect(syncDeposit).not.toHaveBeenCalled();
    });

    it("ignores a payout event for a withdrawal we don't have", async () => {
        jest.mocked(provider.parseWebhook).mockReturnValue(parsed("payout"));
        jest.mocked(selectWithdrawalIdByReference).mockResolvedValue(undefined);
        const { data } = await processWebhookEvent({ id: "row-1" });
        expect(data.status).toBe("ignored");
        expect(syncWithdrawal).not.toHaveBeenCalled();
    });

    it("records a failure (for the sweeper to retry) with a bounded message", async () => {
        jest.mocked(syncDeposit).mockRejectedValue(new Error("x".repeat(800)));
        const { data } = await processWebhookEvent({ id: "row-1" });
        expect(data.status).toBe("failed");
        const call = jest.mocked(updateWebhookEventResult).mock.calls[0][0];
        expect(call.status).toBe("failed");
        expect(call.lastError).toHaveLength(500);
    });

    it("does nothing for an already processed event", async () => {
        jest.mocked(selectWebhookEvent).mockResolvedValue({ ...row, status: "processed" });
        await processWebhookEvent({ id: "row-1" });
        expect(updateWebhookEventAttempt).not.toHaveBeenCalled();
        expect(syncDeposit).not.toHaveBeenCalled();
    });
});
