import Decimal from "decimal.js";
import createDepositCredit from "@/actions/depositCredit/createDepositCredit";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import selectCurrentMarkup from "@/actions/depositCredit/createDepositCredit/queries/selectCurrentMarkup";
import updateDepositCompleted from "@/actions/depositCredit/createDepositCredit/queries/updateDepositCompleted";
import { depositRecord } from "./fakeProvider";

jest.mock("@/services/realtime/publishUserEvent");
jest.mock("@/actions/ledger/createLedgerPosting");
jest.mock("@/actions/auditLog/createAuditLog");
jest.mock("@/actions/depositCredit/createDepositCredit/queries/selectCurrentMarkup");
jest.mock("@/actions/depositCredit/createDepositCredit/queries/updateDepositCompleted");

const base = { trx: {} as never, provider: "fakepay", depositId: "d-1", wallet: { userId: "u-1", assetId: "a-1", symbol: "USDT" } };
const entries = () => jest.mocked(createLedgerPosting).mock.calls[0][0].entries;

describe("createDepositCredit", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectCurrentMarkup).mockResolvedValue({ id: "m-1", markupPercent: "2.500" });
        jest.mocked(createLedgerPosting).mockResolvedValue({ data: { transactionId: "lt-1" } });
    });

    it("credits gross − markup, rounding the provider's naira down to the kobo", async () => {
        const { data } = await createDepositCredit({ ...base, record: depositRecord({ grossNgn: "20310.45645038847" }) });

        expect(data).toEqual({ grossNgn: "20310.45", markupNgn: "507.76", netNgn: "19802.69" });
        expect(entries()).toEqual([
            { account: { kind: "user_available", userId: "u-1" }, amount: "19802.69" },
            { account: { kind: "markup_revenue" }, amount: "507.76" },
            { account: { kind: "provider_clearing", provider: "fakepay" }, amount: "-20310.45" },
        ]);
        const sum = entries().reduce((total, entry) => total.plus(entry.amount), new Decimal(0));
        expect(sum.isZero()).toBe(true);
        expect(jest.mocked(createLedgerPosting).mock.calls[0][0].idempotencyKey).toBe("deposit:fakepay:trade-1");
        expect(updateDepositCompleted).toHaveBeenCalledWith(expect.objectContaining({ ledgerTransactionId: "lt-1" }));
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "crypto.deposit.credited" }));
    });

    it("skips the markup entry when the markup is 0%", async () => {
        jest.mocked(selectCurrentMarkup).mockResolvedValue({ id: "m-0", markupPercent: "0.000" });
        await createDepositCredit({ ...base, record: depositRecord() });
        expect(entries().map((entry) => entry.account.kind)).toEqual(["user_available", "provider_clearing"]);
    });

    it("refuses to credit without a configured markup (never assumes 0%)", async () => {
        jest.mocked(selectCurrentMarkup).mockResolvedValue(undefined);
        await expect(createDepositCredit({ ...base, record: depositRecord() })).rejects.toThrow(/No conversion markup/);
        expect(createLedgerPosting).not.toHaveBeenCalled();
    });

    it("refuses to credit when the provider reported no naira (merchant wallet not NGN)", async () => {
        await expect(createDepositCredit({ ...base, record: depositRecord({ grossNgn: null }) })).rejects.toThrow(/NGN/);
        expect(createLedgerPosting).not.toHaveBeenCalled();
    });

    it("refuses a zero-value credit for manual review", async () => {
        await expect(createDepositCredit({ ...base, record: depositRecord({ grossNgn: "0.004" }) })).rejects.toThrow(/manual review/);
        expect(createLedgerPosting).not.toHaveBeenCalled();
    });
});
