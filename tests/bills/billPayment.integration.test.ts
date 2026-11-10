/**
 * Real-Postgres check of the bill payment money path (skipped by default).
 * Run against a DISPOSABLE, fully migrated database — money rows can't be deleted:
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/bills/billPayment.integration.test.ts
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createBillPayment from "@/actions/billPayment/createBillPayment";
import syncBillPayment from "@/actions/billPayment/syncBillPayment";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import BillProviderError from "@/services/bills/billProviderError";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import BILLS from "@/constants/bills";
import { billPaymentRecord, makeFakeBillProvider } from "./fakeBillProvider";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("bill payments against Postgres", () => {
    const tag = randomUUID().slice(0, 6);
    const provider = `fb${tag}`;
    const payBill = jest.fn();
    const getBillPayment = jest.fn();
    const validateCustomer = jest.fn();
    let userId: string;
    let bundleId: string;
    let airtimeId: string;
    let prepaidId: string;

    const balance = async (kind: string, owner: { userId?: string; provider?: string } = {}) => {
        const row = await db
            .selectFrom("ledger_accounts")
            .select(["balance"])
            .where("kind", "=", kind)
            .where("currency", "=", "NGN")
            .where("userId", owner.userId ? "=" : "is", owner.userId ?? null)
            .where("provider", owner.provider ? "=" : "is", owner.provider ?? null)
            .executeTakeFirst();
        return row?.balance ?? "0";
    };
    const userBalance = () => balance(LEDGER_ACCOUNT_KIND.USER_AVAILABLE, { userId });
    const payment = (id: string) =>
        db.selectFrom("bill_payments").select(["status", "providerReference", "token", "providerCost", "failureReason", "total"]).where("id", "=", id).executeTakeFirstOrThrow();
    const pay = (overrides: { productId?: string; amount?: string | null; idempotencyKey?: string; customerId?: string } = {}) =>
        createBillPayment({
            userId,
            productId: overrides.productId ?? bundleId,
            customerId: overrides.customerId ?? "08038291822",
            amount: overrides.amount ?? null,
            idempotencyKey: overrides.idempotencyKey ?? randomUUID(),
            pin: "4827",
            ipAddress: null,
            userAgent: null,
        });

    beforeAll(async () => {
        const user = await db.insertInto("users").values({ phoneNumber: `+23482${Date.now().toString().slice(-8)}`, status: "active" } as never).returning(["id"]).executeTakeFirstOrThrow();
        userId = user.id;

        await db.transaction().execute((trx) =>
            createLedgerPosting({
                trx,
                idempotencyKey: `test-fund-${userId}`,
                type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT,
                description: "Test funding",
                entries: [
                    { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: "10000.00" },
                    { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: "testfund" }, amount: "-10000.00" },
                ],
            }),
        );

        const billerId = async (slug: string) => (await db.selectFrom("billers").select(["id"]).where("slug", "=", slug).executeTakeFirstOrThrow()).id;
        const ref = async (slug: string) =>
            (await db.insertInto("biller_provider_refs").values({
                billerId: await billerId(slug), provider, environment: "sandbox", providerBillerRef: `${slug}-${tag}`, providerName: slug,
                status: "confirmed", reviewedAt: new Date(), isAvailable: true,
            }).returning(["id"]).executeTakeFirstOrThrow()).id;

        bundleId = (await db.insertInto("bill_products").values({
            billerProviderRefId: await ref("mtn-data"), provider, environment: "sandbox", providerProductRef: `BIL104:MD107-${tag}`,
            providerName: "MTN 1.5 GB", name: "1.5GB", amountType: "fixed", currency: "NGN", price: "1000.00", serviceFee: "50.00", isAvailable: true, isEnabled: true,
        }).returning(["id"]).executeTakeFirstOrThrow()).id;
        airtimeId = (await db.insertInto("bill_products").values({
            billerProviderRefId: await ref("mtn-airtime"), provider, environment: "sandbox", providerProductRef: `BIL099:AT099-${tag}`,
            providerName: "AIRTIME", name: "Airtime", amountType: "range", currency: "NGN", minAmount: "50.00", maxAmount: "50000.00", serviceFee: "0.00", isAvailable: true, isEnabled: true,
        }).returning(["id"]).executeTakeFirstOrThrow()).id;

        prepaidId = (await db.insertInto("bill_products").values({
            billerProviderRefId: await ref("ikeja-electric"), provider, environment: "sandbox", providerProductRef: `BIL113:UB159-${tag}`,
            providerName: "IKEDC PREPAID", name: "Prepaid", amountType: "range", currency: "NGN", minAmount: "500.00", maxAmount: "500000.00",
            serviceFee: "0.00", isAvailable: true, isEnabled: true,
        }).returning(["id"]).executeTakeFirstOrThrow()).id;

        billProviderRegistry.reset();
        billProviderRegistry.register(makeFakeBillProvider({ name: provider, payBill, getBillPayment, validateCustomer }));
    });

    beforeEach(() => {
        payBill.mockReset();
        getBillPayment.mockReset();
        validateCustomer.mockReset();
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } });
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterAll(async () => {
        billProviderRegistry.reset();
        await disconnect();
    });

    it("holds the money, then settles a delivered payment with Doviz's margin", async () => {
        payBill.mockImplementation(async ({ externalId }) => billPaymentRecord({ externalId, providerReference: "CF-1", status: "pending" }));

        const { data, isNew } = await pay();
        expect(isNew).toBe(true);
        expect(data).toMatchObject({ status: "pending", amount: "1000.00", serviceFee: "50.00", total: "1050.00", product: { name: "1.5GB" }, biller: { name: "MTN" } });
        expect(payBill).toHaveBeenCalledWith({ externalId: data!.id, providerProductRef: `BIL104:MD107-${tag}`, customerId: "08038291822", amount: { amount: "1000.00", currency: "NGN" } });
        expect(await userBalance()).toBe("8950.00");
        expect(await balance(LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, { provider })).toBe("1050.00");

        getBillPayment.mockResolvedValue(billPaymentRecord({ externalId: data!.id, providerReference: "CF-1", status: "completed", cost: { amount: "990.00", currency: "NGN" }, token: "1111-2222" }));
        await expect(syncBillPayment({ billPaymentId: data!.id })).resolves.toEqual({ data: { outcome: "completed" } });
        expect(getBillPayment).toHaveBeenCalledWith({ externalId: data!.id, providerReference: "CF-1" });

        expect(await payment(data!.id)).toMatchObject({ status: "completed", providerCost: "990.00", token: "1111-2222" });
        expect(await userBalance()).toBe("8950.00");
        expect(await balance(LEDGER_ACCOUNT_KIND.BILLS_IN_TRANSIT, { provider })).toBe("0.00");
        expect(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, { provider })).toBe("990.00");
        expect(Number(await balance(LEDGER_ACCOUNT_KIND.BILL_REVENUE))).toBeGreaterThanOrEqual(60);

        // Webhook + reconciler + status read all syncing again changes nothing.
        await expect(syncBillPayment({ billPaymentId: data!.id })).resolves.toEqual({ data: { outcome: "unchanged" } });
        const settlements = await db.selectFrom("ledger_transactions").select(["id"]).where("idempotencyKey", "=", `bill-settle:${data!.id}`).execute();
        expect(settlements).toHaveLength(1);
    });

    it("never pays twice for a reused idempotency key", async () => {
        payBill.mockImplementation(async ({ externalId }) => billPaymentRecord({ externalId, providerReference: "CF-2" }));
        const idempotencyKey = randomUUID();
        const before = await userBalance();

        const first = await pay({ idempotencyKey });
        const second = await pay({ idempotencyKey });

        expect(second.isNew).toBe(false);
        expect(second.data!.id).toBe(first.data!.id);
        expect(payBill).toHaveBeenCalledTimes(1);
        expect(Number(await userBalance())).toBe(Number(before) - 1050);
    });

    it("refunds at once when the provider declines it", async () => {
        payBill.mockRejectedValue(new BillProviderError({ code: "rejected", status: 400, providerMessage: "Invalid customer" }));
        const before = await userBalance();

        const { data } = await pay({ productId: airtimeId, amount: "500.00" });
        expect(data).toMatchObject({ status: "failed", total: "500.00", failureReason: "The biller declined this payment. Your money has been returned." });
        expect(await userBalance()).toBe(before);
    });

    it("keeps an unknown outcome as processing, and refunds only when the provider says it failed", async () => {
        payBill.mockRejectedValue(new BillProviderError({ code: "unavailable", status: null, providerMessage: null }));
        const before = await userBalance();

        const { data } = await pay({ productId: airtimeId, amount: "200.00" });
        expect(data!.status).toBe("processing");
        expect(Number(await userBalance())).toBe(Number(before) - 200);

        getBillPayment.mockResolvedValue(billPaymentRecord({ externalId: data!.id, status: "pending" }));
        await expect(syncBillPayment({ billPaymentId: data!.id })).resolves.toEqual({ data: { outcome: "pending" } });

        getBillPayment.mockResolvedValue(billPaymentRecord({ externalId: data!.id, status: "failed", failureReason: "Biller down" }));
        await expect(syncBillPayment({ billPaymentId: data!.id })).resolves.toEqual({ data: { outcome: "refunded" } });
        expect(await userBalance()).toBe(before);
    });

    it("answers pending when the provider is slow, and finishes the payment in the background", async () => {
        const shortWait = jest.replaceProperty(BILLS, "SUBMIT_WAIT_MS", 50);
        let release!: () => void;
        payBill.mockImplementation(({ externalId }) =>
            new Promise((resolve) => (release = () => resolve(billPaymentRecord({ externalId, providerReference: "CF-SLOW" })))));

        const started = Date.now();
        const { data } = await pay({ productId: airtimeId, amount: "100.00" });
        expect(Date.now() - started).toBeLessThan(2000);
        expect(data).toMatchObject({ status: "pending" });
        expect((await payment(data!.id)).providerReference).toBeNull();

        release();
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect((await payment(data!.id)).providerReference).toBe("CF-SLOW");
        shortWait.restore();
    });

    describe("meter numbers are checked by the server before any money moves", () => {
        const meter = { productId: "", customerId: "45067198783", amount: "1000.00" };
        beforeEach(() => (meter.productId = prepaidId));

        it("pays a meter the provider knows, keeping the name on it", async () => {
            validateCustomer.mockResolvedValue({ customerName: "ADA OKAFOR", address: null, minAmount: null, maxAmount: null });
            payBill.mockImplementation(async ({ externalId }) => billPaymentRecord({ externalId, providerReference: "CF-MTR" }));

            const { data } = await pay(meter);
            expect(validateCustomer).toHaveBeenCalledWith({ providerProductRef: `BIL113:UB159-${tag}`, customerId: "45067198783" });
            expect(data).toMatchObject({ status: "pending", customerName: "ADA OKAFOR" });
        });

        it("refuses an unknown meter without touching the balance", async () => {
            validateCustomer.mockRejectedValue(new BillProviderError({ code: "rejected", status: 400, providerMessage: "Invalid meter" }));
            const before = await userBalance();

            const result = await pay(meter);
            expect(result).toMatchObject({ data: null, failure: "customer_not_found" });
            expect(payBill).not.toHaveBeenCalled();
            expect(await userBalance()).toBe(before);
        });

        it("applies the meter's own limits", async () => {
            validateCustomer.mockResolvedValue({ customerName: "ADA OKAFOR", address: null, minAmount: "1500.00", maxAmount: null });
            const before = await userBalance();

            const result = await pay(meter);
            expect(result).toMatchObject({ data: null, failure: "amount_out_of_range", limits: { minAmount: "1500.00", maxAmount: null } });
            expect(await userBalance()).toBe(before);
        });

        it("takes nothing when the provider can't check the meter", async () => {
            validateCustomer.mockRejectedValue(new BillProviderError({ code: "unavailable", status: null, providerMessage: null }));
            const before = await userBalance();

            expect(await pay(meter)).toMatchObject({ data: null, failure: "provider_unavailable" });
            expect(payBill).not.toHaveBeenCalled();
            expect(await userBalance()).toBe(before);
        });
    });

    it("refuses a payment the balance can't cover, leaving no trace", async () => {
        const before = await userBalance();
        const { data, failure } = await pay({ productId: airtimeId, amount: "50000.00" });

        expect(data).toBeNull();
        expect(failure).toBe("insufficient_balance");
        expect(payBill).not.toHaveBeenCalled();
        expect(await userBalance()).toBe(before);
    });

    it("refunds a long-lost payment only if the provider never acknowledged it", async () => {
        payBill.mockRejectedValue(new BillProviderError({ code: "unavailable", status: null, providerMessage: null }));
        getBillPayment.mockResolvedValue(null);
        const before = await userBalance();

        const neverReached = (await pay({ productId: airtimeId, amount: "100.00" })).data!;
        payBill.mockImplementation(async ({ externalId }) => billPaymentRecord({ externalId, providerReference: "CF-ACK" }));
        const acknowledged = (await pay({ productId: airtimeId, amount: "100.00" })).data!;

        // Not overdue yet: nothing happens.
        await expect(syncBillPayment({ billPaymentId: neverReached.id })).resolves.toEqual({ data: { outcome: "pending" } });

        await db.updateTable("bill_payments").set({ requestedAt: new Date(Date.now() - 31 * 60 * 1000) }).where("id", "in", [neverReached.id, acknowledged.id]).execute();

        await expect(syncBillPayment({ billPaymentId: neverReached.id })).resolves.toEqual({ data: { outcome: "refunded" } });
        await expect(syncBillPayment({ billPaymentId: acknowledged.id })).resolves.toEqual({ data: { outcome: "needs_review" } });

        expect((await payment(acknowledged.id)).status).toBe("pending");
        expect(Number(await userBalance())).toBe(Number(before) - 100);
    });
});
