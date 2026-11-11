import request from "supertest";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectStatementEntries from "@/actions/walletTransactions/fetchWalletTransactions/queries/selectStatementEntries";
import selectStatementEntry from "@/actions/walletTransaction/fetchWalletTransaction/queries/selectStatementEntry";
import selectUserStatementEntry from "@/schemaHelpers/selectUserStatementEntry";
import encodeStatementCursor from "@/utils/wallet/encodeStatementCursor";
import { LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { useFakeProvider } from "./fakeProvider";
import { authHeader, createTestApp } from "./testApp";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/walletTransactions/fetchWalletTransactions/queries/selectStatementEntries");
jest.mock("@/actions/walletTransaction/fetchWalletTransaction/queries/selectStatementEntry");
jest.mock("@/schemaHelpers/selectUserStatementEntry");

const app = createTestApp();
const get = (path: string) => request(app).get(`/api/v1/app/wallet${path}`).set("Authorization", authHeader());
const ENTRY = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const noTransfer = {
    transferId: null, transferSenderTag: null, transferRecipientTag: null, transferNote: null,
    transferSenderFirstName: null, transferSenderLastName: null, transferRecipientFirstName: null, transferRecipientLastName: null,
};
const NO_FILTERS = { direction: null, type: null, from: null, to: null };
const entry = (id: string) => ({
    id, amount: "156000.00", balanceAfter: "156000.00", createdAt: new Date(), type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT,
    depositId: "dep-1", symbol: "USDT", network: "TRC20", cryptoAmount: "100.000000",
    grossNgn: "157560.00", markupNgn: "1560.00", markupPercent: "1.00", ...noTransfer,
});

const noBankTransfer = { nairaDepositId: null, senderName: null, senderBankName: null, senderAccountNumber: null };

describe("wallet statement routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        useFakeProvider();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
    });

    it("fetches one extra row and returns a cursor for the last item shown", async () => {
        jest.mocked(selectStatementEntries).mockResolvedValue([entry("e-1"), entry("e-2"), entry("e-3")]);
        const response = await get("/transactions?size=2");
        expect(selectStatementEntries).toHaveBeenCalledWith({ userId: "user-1", afterEntryId: null, limit: 3, filters: NO_FILTERS });
        expect(response.body.data.items).toHaveLength(2);
        expect(response.body.data.nextCursor).toBe(encodeStatementCursor({ entryId: "e-2" }));
        expect(response.body.data.items[0]).toMatchObject({ direction: "credit", amount: "156000.00", deposit: { cryptoAmount: "100" } });
    });

    it("decodes the cursor and ends with nextCursor null", async () => {
        jest.mocked(selectStatementEntries).mockResolvedValue([entry("e-4")]);
        const response = await get(`/transactions?cursor=${encodeStatementCursor({ entryId: ENTRY })}`);
        expect(selectStatementEntries).toHaveBeenCalledWith({ userId: "user-1", afterEntryId: ENTRY, limit: 21, filters: NO_FILTERS });
        expect(response.body.data.nextCursor).toBeNull();
    });

    it("passes filters through, normalised, and keeps paging inside them", async () => {
        jest.mocked(selectStatementEntries).mockResolvedValue([entry("e-1")]);
        const from = "2026-11-01T00:00:00+01:00";
        const to = "2026-11-08T00:00:00+01:00";
        const cursor = encodeStatementCursor({ entryId: ENTRY });
        const response = await get(
            `/transactions?direction=DEBIT&type=bill&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&cursor=${cursor}`,
        );
        expect(response.status).toBe(200);
        expect(selectStatementEntries).toHaveBeenCalledWith({
            userId: "user-1",
            afterEntryId: ENTRY,
            limit: 21,
            filters: { direction: "debit", type: "bill", from: new Date(from), to: new Date(to) },
        });
    });

    it.each([
        "direction=sideways",
        "type=gifts",
        "from=2026-11-01",
        "from=yesterday",
        `from=${encodeURIComponent("2026-11-08T00:00:00+01:00")}&to=${encodeURIComponent("2026-11-01T00:00:00+01:00")}`,
        `from=${encodeURIComponent("2026-11-01T00:00:00+01:00")}&to=${encodeURIComponent("2026-11-01T00:00:00+01:00")}`,
        `from=${encodeURIComponent("2024-01-01T00:00:00+01:00")}&to=${encodeURIComponent("2026-01-01T00:00:00+01:00")}`,
    ])("rejects filter %s", async (query) => {
        const response = await get(`/transactions?${query}`);
        expect(response.status).toBe(400);
        expect(selectStatementEntries).not.toHaveBeenCalled();
    });

    it.each(["size=51", "size=0", "size=abc", "cursor=not-a-cursor"])("rejects %s", async (query) => {
        const response = await get(`/transactions?${query}`);
        expect(response.status).toBe(400);
        expect(selectStatementEntries).not.toHaveBeenCalled();
    });

    it("returns one line with full conversion details", async () => {
        jest.mocked(selectUserStatementEntry).mockResolvedValue({ id: ENTRY });
        jest.mocked(selectStatementEntry).mockResolvedValue({
            ...entry(ENTRY), rateNgnPerUsd: "1575.60", txHash: "0xabc", confirmations: 20, detectedAt: new Date(), completedAt: new Date(),
            ...noBankTransfer,
        });
        const response = await get(`/transactions/${ENTRY}`);
        expect(response.status).toBe(200);
        expect(response.body.data.deposit).toMatchObject({ rateNgnPerUsd: "1575.60", txHash: "0xabc", markupNgn: "1560.00" });
        expect(response.body.data.bankTransfer).toBeNull();
    });

    it("shows who sent a bank-transfer top-up (masked), and null when the provider didn't say", async () => {
        jest.mocked(selectUserStatementEntry).mockResolvedValue({ id: ENTRY });
        const line = { ...entry(ENTRY), rateNgnPerUsd: null, txHash: null, confirmations: null, detectedAt: null, completedAt: null };
        jest.mocked(selectStatementEntry).mockResolvedValue({
            ...line, nairaDepositId: "dep-1", senderName: "ADA OKAFOR", senderBankName: "First Bank", senderAccountNumber: "******1001",
        } as never);
        const response = await get(`/transactions/${ENTRY}`);
        expect(response.body.data.bankTransfer).toEqual({ id: "dep-1", sender: { name: "ADA OKAFOR", bankName: "First Bank", accountNumber: "******1001" } });

        jest.mocked(selectStatementEntry).mockResolvedValue({ ...line, ...noBankTransfer, nairaDepositId: "dep-2" } as never);
        expect((await get(`/transactions/${ENTRY}`)).body.data.bankTransfer).toEqual({ id: "dep-2", sender: null });
    });

    it("answers 400 for someone else's (or a missing) line and never loads it", async () => {
        jest.mocked(selectUserStatementEntry).mockResolvedValue(undefined);
        const response = await get(`/transactions/${ENTRY}`);
        expect(response.status).toBe(400);
        expect(selectStatementEntry).not.toHaveBeenCalled();
    });
});
