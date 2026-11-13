/**
 * Real-Postgres check of the withdrawal money path (skipped by default).
 * Run against a DISPOSABLE, fully migrated database — money rows can't be deleted:
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/payouts/withdrawal.integration.test.ts
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createWithdrawal from "@/actions/withdrawal/createWithdrawal";
import syncWithdrawal from "@/actions/withdrawal/syncWithdrawal";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import payoutProviderRegistry from "@/services/payouts/payoutProviderRegistry";
import PayoutProviderError from "@/services/payouts/payoutProviderError";
import { PayoutProvider } from "@/services/payouts/payoutProvider";
import { ProviderPayout } from "@/services/payouts/types";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("withdrawals against Postgres", () => {
    const tag = randomUUID().slice(0, 6);
    const providerA = `pa${tag}`;
    const providerB = `pb${tag}`;
    const fake = (name: string) => ({
        name,
        environment: "sandbox" as const,
        listBanks: jest.fn(),
        resolveAccount: jest.fn(),
        sendPayout: jest.fn(),
        getPayout: jest.fn(),
        getBalance: jest.fn().mockResolvedValue(null),
    });
    const a = fake(providerA);
    const b = fake(providerB);
    let userId: string;
    let bankAccountId: string;
    let previousActive: string | undefined;

    const payout = (externalId: string, overrides: Partial<ProviderPayout> = {}): ProviderPayout => ({
        externalId, providerReference: `ref-${externalId.slice(0, 6)}`, status: "pending",
        amount: { amount: "0.00", currency: "NGN" }, fee: null, failureReason: null, ...overrides,
    });
    const balance = async (kind: string, owner: { userId?: string; provider?: string } = {}) => {
        const row = await db.selectFrom("ledger_accounts").select(["balance"]).where("kind", "=", kind).where("currency", "=", "NGN")
            .where("userId", owner.userId ? "=" : "is", owner.userId ?? null).where("provider", owner.provider ? "=" : "is", owner.provider ?? null)
            .executeTakeFirst();
        return row?.balance ?? "0";
    };
    const userBalance = () => balance(LEDGER_ACCOUNT_KIND.USER_AVAILABLE, { userId });
    const activate = (name: string) => db.updateTable("provider_settings").set({ activeProvider: name }).where("service", "=", "payouts").execute();
    const withdraw = (amount: string, expectedTotal: string, idempotencyKey = randomUUID(), forUser = userId, account = bankAccountId) =>
        createWithdrawal({ userId: forUser, destination: { bankAccountId: account }, narration: null, amount, expectedTotal, idempotencyKey, pin: "4827", ipAddress: null, userAgent: null });
    const row = (id: string) => db.selectFrom("bank_withdrawals").select(["status", "fee", "feeReserve", "totalHeld", "provider"]).where("id", "=", id).executeTakeFirstOrThrow();

    const newUser = async (funds: string) => {
        const user = await db.insertInto("users").values({ phoneNumber: `+23483${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`, status: "active", firstName: "Ada", lastName: "Okafor" } as never)
            .returning(["id"]).executeTakeFirstOrThrow();
        await db.transaction().execute((trx) => createLedgerPosting({
            trx, idempotencyKey: `test-fund-${user.id}`, type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT, description: "Test funding",
            entries: [
                { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: user.id }, amount: funds },
                { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: "testfund" }, amount: `-${funds}` },
            ],
        }));
        const bank = await db.selectFrom("payout_banks").select(["id"]).where("slug", "=", `test-bank-${tag}`).executeTakeFirstOrThrow();
        const account = await db.insertInto("user_bank_accounts").values({
            userId: user.id, payoutBankId: bank.id, accountNumber: "0123456789", accountName: "OKAFOR ADA", isPrimary: true, status: "active", verifiedAt: new Date(),
        } as never).returning(["id"]).executeTakeFirstOrThrow();
        return { userId: user.id, bankAccountId: account.id };
    };

    beforeAll(async () => {
        const bank = await db.insertInto("payout_banks").values({ name: `Test Bank ${tag}`, slug: `test-bank-${tag}`, code: null, isEnabled: true })
            .returning(["id"]).executeTakeFirstOrThrow();
        await db.insertInto("provider_banks").values({ payoutBankId: bank.id, provider: providerA, environment: "sandbox", providerBankId: "033", syncedAt: new Date() }).execute();
        ({ userId, bankAccountId } = await newUser("10000.00"));

        previousActive = (await db.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", "payouts").executeTakeFirst())?.activeProvider;
        await activate(providerA);
        payoutProviderRegistry.reset();
        payoutProviderRegistry.register(a as PayoutProvider);
        payoutProviderRegistry.register(b as PayoutProvider);
    });

    beforeEach(async () => {
        await activate(providerA);
        for (const provider of [a, b]) {
            provider.sendPayout.mockReset();
            provider.getPayout.mockReset();
            provider.getBalance.mockReset().mockResolvedValue(null);
        }
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } });
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterAll(async () => {
        if (previousActive) await activate(previousActive);
        payoutProviderRegistry.reset();
        await disconnect();
    });

    it("charges the real fee even above the reserve (first time: no history, nothing reserved)", async () => {
        a.sendPayout.mockImplementation(async ({ externalId }) => payout(externalId));
        const { data, isNew } = await withdraw("1000.00", "1000.00");
        expect(isNew).toBe(true);
        expect(data).toMatchObject({ status: "pending", amount: "1000.00", feeReserve: "0.00", totalHeld: "1000.00", bankAccount: { accountNumber: "******6789" } });
        expect(a.sendPayout).toHaveBeenCalledWith(expect.objectContaining({ providerBankId: "033", accountNumber: "0123456789", amount: { amount: "1000.00", currency: "NGN" } }));

        a.getPayout.mockResolvedValue(payout(data!.id, { status: "completed", fee: { amount: "15.00", currency: "NGN" } }));
        await expect(syncWithdrawal({ withdrawalId: data!.id })).resolves.toEqual({ data: { outcome: "completed" } });

        expect(await row(data!.id)).toMatchObject({ status: "completed", fee: "15.00" });
        expect(await userBalance()).toBe("8985.00"); // 10,000 − 1,000 − real fee 15
        expect(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, { provider: providerA })).toBe("1015.00");
        expect(await balance(LEDGER_ACCOUNT_KIND.PAYOUTS_IN_TRANSIT, { provider: providerA })).toBe("0.00");
    });

    it("reserves the highest recent fee, then returns what the real fee didn't use", async () => {
        a.sendPayout.mockImplementation(async ({ externalId }) => payout(externalId));
        const { data } = await withdraw("2000.00", "2015.00");
        expect(data).toMatchObject({ feeReserve: "15.00", totalHeld: "2015.00" });
        expect(await userBalance()).toBe("6970.00");

        a.getPayout.mockResolvedValue(payout(data!.id, { status: "completed", fee: { amount: "10.00", currency: "NGN" } }));
        await syncWithdrawal({ withdrawalId: data!.id });
        expect(await userBalance()).toBe("6975.00"); // ₦5 of unused reserve back
        expect(await syncWithdrawal({ withdrawalId: data!.id })).toEqual({ data: { outcome: "unchanged" } });
    });

    it("refuses a stale total (fee or provider changed) without holding anything", async () => {
        const before = await userBalance();
        const result = await withdraw("500.00", "500.00"); // reserve is 15 now
        expect(result).toMatchObject({ data: null, failure: "quote_changed", quote: { totalHeld: "515.00", fee: "15.00", feeIsExact: false } });
        expect(a.sendPayout).not.toHaveBeenCalled();
        expect(await userBalance()).toBe(before);
    });

    it("refunds at once when the provider declines", async () => {
        a.sendPayout.mockRejectedValue(new PayoutProviderError({ code: "rejected", status: 400, providerMessage: "Invalid account." }));
        const before = await userBalance();
        const { data } = await withdraw("500.00", "515.00");
        expect(data).toMatchObject({ status: "failed", failureReason: "Your bank transfer was declined. Your money has been returned." });
        expect(await userBalance()).toBe(before);
    });

    it("keeps an unknown outcome as processing, and refunds only on a confirmed failure", async () => {
        a.sendPayout.mockRejectedValue(new PayoutProviderError({ code: "unavailable", status: 502, providerMessage: null }));
        const before = await userBalance();
        const { data } = await withdraw("300.00", "315.00");
        expect(data!.status).toBe("processing");

        a.getPayout.mockResolvedValue(payout(data!.id, { status: "failed", failureReason: "Dormant account" }));
        await expect(syncWithdrawal({ withdrawalId: data!.id })).resolves.toEqual({ data: { outcome: "refunded" } });
        expect(await userBalance()).toBe(before);
    });

    it("finishes an in-flight withdrawal with its own provider after a switch", async () => {
        a.sendPayout.mockImplementation(async ({ externalId }) => payout(externalId));
        const { data } = await withdraw("100.00", "115.00");
        await activate(providerB);

        a.getPayout.mockResolvedValue(payout(data!.id, { status: "completed", fee: { amount: "15.00", currency: "NGN" } }));
        await syncWithdrawal({ withdrawalId: data!.id });
        expect(a.getPayout).toHaveBeenCalled();
        expect(b.getPayout).not.toHaveBeenCalled();
        expect(await row(data!.id)).toMatchObject({ status: "completed", provider: providerA });
    });

    it("refuses a bank the active provider can't pay to, before any money moves", async () => {
        await activate(providerB); // B has no mapping for the test bank
        const before = await userBalance();
        expect(await withdraw("100.00", "100.00")).toMatchObject({ data: null, failure: "bank_unsupported" });
        expect(await userBalance()).toBe(before);
    });

    it("checks the provider's float when it reports one, and goes ahead when it can't", async () => {
        a.getBalance.mockResolvedValue({ amount: "10.00", currency: "NGN" });
        expect(await withdraw("100.00", "115.00")).toMatchObject({ data: null, failure: "provider_unavailable" });
        expect(a.sendPayout).not.toHaveBeenCalled();

        a.getBalance.mockRejectedValue(new Error("no balance API"));
        a.sendPayout.mockImplementation(async ({ externalId }) => payout(externalId));
        expect((await withdraw("100.00", "115.00")).data?.status).toBe("pending");
    });

    it("applies the provider's own limits before holding anything", async () => {
        Object.assign(a, { limits: { minAmount: "1000.00", maxAmount: "10000000.00" } });
        const before = await userBalance();
        expect(await withdraw("500.00", "515.00")).toMatchObject({ data: null, failure: "amount_out_of_range", limits: { minAmount: "1000.00" } });
        expect(a.sendPayout).not.toHaveBeenCalled();
        expect(await userBalance()).toBe(before);
        delete (a as { limits?: unknown }).limits;
    });

    it("never pays twice for a reused idempotency key", async () => {
        a.sendPayout.mockImplementation(async ({ externalId }) => payout(externalId));
        const key = randomUUID();
        const first = await withdraw("100.00", "115.00", key);
        const second = await withdraw("100.00", "115.00", key);
        expect(second).toMatchObject({ isNew: false, data: { id: first.data!.id } });
        expect(a.sendPayout).toHaveBeenCalledTimes(1);
    });

    it("refuses more than the balance, and absorbs a fee the user's balance can't cover", async () => {
        const poor = await newUser("115.00");
        expect(await withdraw("200.00", "215.00", randomUUID(), poor.userId, poor.bankAccountId)).toMatchObject({ failure: "insufficient_balance" });

        a.sendPayout.mockImplementation(async ({ externalId }) => payout(externalId));
        const { data } = await withdraw("100.00", "115.00", randomUUID(), poor.userId, poor.bankAccountId);
        a.getPayout.mockResolvedValue(payout(data!.id, { status: "completed", fee: { amount: "40.00", currency: "NGN" } }));
        const feesBefore = Number(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_FEES, { provider: providerA }));
        await syncWithdrawal({ withdrawalId: data!.id });

        expect(await balance(LEDGER_ACCOUNT_KIND.USER_AVAILABLE, { userId: poor.userId })).toBe("0.00");
        expect(Number(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_FEES, { provider: providerA })) - feesBefore).toBe(-25); // 40 − 15 reserve, user had 0
    });
});
