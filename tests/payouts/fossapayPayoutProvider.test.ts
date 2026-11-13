import FossapayPayoutProvider from "@/services/payouts/providers/fossapay/fossapayPayoutProvider";
import FossapayClient from "@/services/fossapay/fossapayClient";
import { parseFossapayWebhook } from "@/services/virtualAccounts/providers/fossapay/fossapayWebhooks";

const WITHDRAWAL = "0b6c3a3e-1f2d-4c5b-8a9e-2d4f6a8b0c1d";
const banks = { status: 200, data: { status: true, data: [{ bankname: "ACCESS BANK", bankcode: "044" }, { bankname: "GTBank", bankcode: "058" }] } };
const payout = (status: string, extra: Record<string, unknown> = {}) => ({ status: 202, data: { status: "success", data: { payoutId: "po-1", reference: WITHDRAWAL, status, amount: 5000, fee: "80.00", totalDebited: "5080.00", ...extra } } });

describe("Fossapay payouts (from the master wallet)", () => {
    const get = jest.fn();
    const post = jest.fn();
    let fossapay: FossapayPayoutProvider;
    const send = () => fossapay.sendPayout({ externalId: WITHDRAWAL, providerBankId: "058", accountNumber: "0123456789", accountName: "ADA OKAFOR", amount: { amount: "5000.00", currency: "NGN" }, narration: "Ziks withdrawal", customer: { name: "Ada Okafor", email: null } });

    beforeEach(() => {
        jest.resetAllMocks();
        fossapay = new FossapayPayoutProvider({ get, post } as unknown as FossapayClient);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("lists banks and resolves names", async () => {
        get.mockResolvedValueOnce(banks);
        await expect(fossapay.listBanks()).resolves.toEqual([
            { providerBankId: "044", name: "ACCESS BANK", slug: expect.any(String), code: "044" },
            { providerBankId: "058", name: "GTBank", slug: expect.any(String), code: "058" },
        ]);
        post.mockResolvedValueOnce({ status: 201, data: { status: true, data: { accountName: " ADA OKAFOR ", accountNumber: "0123456789" } } });
        await expect(fossapay.resolveAccount({ providerBankId: "058", accountNumber: "0123456789" })).resolves.toEqual({ accountName: "ADA OKAFOR" });
    });

    it("sends with our withdrawal id as reference AND idempotency key, and reads Fossapay's own fee", async () => {
        get.mockResolvedValueOnce(banks);
        post.mockResolvedValueOnce(payout("processing"));
        await expect(send()).resolves.toEqual({ externalId: WITHDRAWAL, providerReference: "po-1", status: "pending", amount: { amount: "5000.00", currency: "NGN" }, fee: { amount: "80.00", currency: "NGN" }, failureReason: null });
        expect(post).toHaveBeenCalledWith(
            "/payouts",
            { amount: 5000, currency: "NGN", reference: WITHDRAWAL, destinationBankCode: "058", destinationBankName: "GTBank", destinationAccountName: "ADA OKAFOR", destinationAccountNumber: "0123456789", remarks: "Ziks withdrawal" },
            { "X-Idempotency-Key": WITHDRAWAL },
        );
    });

    it("returns the payout Fossapay already has after a lost reply or a duplicate, never sending twice", async () => {
        get.mockResolvedValueOnce(banks).mockResolvedValueOnce({ status: 200, data: { data: { payoutId: "po-1", status: "completed", amount: 5000, fee: 80 } } });
        post.mockResolvedValueOnce({ status: 409, data: { message: "Duplicate reference" } });
        await expect(send()).resolves.toMatchObject({ status: "completed", providerReference: "po-1" });
        expect(get).toHaveBeenLastCalledWith(`/payouts/reference/${WITHDRAWAL}`);
    });

    it.each([
        ["an empty float", { status: 400, data: { message: "Insufficient funds" } }, "unavailable"],
        ["our key refused", { status: 401, data: { message: "Invalid API key" } }, "configuration"],
        ["a bad destination", { status: 422, data: { message: "destinationAccountNumber is invalid" } }, "rejected"],
    ])("maps %s to %s", async (_why, reply, code) => {
        get.mockResolvedValueOnce(banks);
        post.mockResolvedValueOnce(reply);
        await expect(send()).rejects.toMatchObject({ code });
    });

    it("treats a reversed payout as failed (money returned), and reads the master balance", async () => {
        get.mockResolvedValueOnce({ status: 200, data: { data: { payoutId: "po-1", status: "reversed", amount: 5000 } } });
        await expect(fossapay.getPayout({ externalId: WITHDRAWAL })).resolves.toMatchObject({ status: "failed", failureReason: "The bank returned the transfer" });
        get.mockResolvedValueOnce({ status: 200, data: { data: { availableBalance: 125000.5 } } });
        await expect(fossapay.getBalance({ currency: "NGN" })).resolves.toEqual({ amount: "125000.50", currency: "NGN" });
    });

    it.each([
        ["100.00", "20.00"],
        ["5000.00", "20.00"],
        ["5000.01", "40.00"],
        ["10000.00", "40.00"],
        ["10000.01", "100.00"],
        ["50000.00", "100.00"],
        ["50000.01", "150.00"],
        ["2000000.00", "150.00"],
    ])("quotes Fossapay's tiered payout fee: ₦%s → ₦%s", async (amount, fee) => {
        await expect(fossapay.quoteFee({ amount: { amount, currency: "NGN" } })).resolves.toEqual({ amount: fee, currency: "NGN" });
    });

    it("routes payout webhooks to our withdrawal by its reference", () => {
        expect(parseFossapayWebhook({ eventId: "e1", eventType: "payout.reversed", data: { reference: WITHDRAWAL } })).toMatchObject({ resourceType: "payout", resourceId: WITHDRAWAL });
    });
});
