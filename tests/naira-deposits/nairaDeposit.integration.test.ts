/**
 * Real-Postgres check of the naira deposit money path (skipped by default).
 * Run against a DISPOSABLE, fully migrated database — money rows can't be deleted:
 *   DB_INTEGRATION=true DB_NAME=<disposable> npx jest tests/naira-deposits/nairaDeposit.integration.test.ts
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createNairaDeposit from "@/actions/nairaDeposit/createNairaDeposit";
import syncNairaDeposit from "@/actions/nairaDeposit/syncNairaDeposit";
import fetchOpenNairaDeposits from "@/actions/nairaDeposits/fetchOpenNairaDeposits";
import fetchActiveNairaDeposit from "@/actions/nairaDeposit/fetchActiveNairaDeposit";
import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import CollectionProviderError from "@/services/collections/collectionProviderError";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";
import { bankTransferCreated, bankTransferRecord, makeFakeCollectionProvider } from "./fakeCollectionProvider";

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("naira deposits against Postgres", () => {
    const tag = randomUUID().slice(0, 6);
    const primary = `fc${tag}`;
    const backup = `fb${tag}`;
    const createPrimary = jest.fn();
    const getPrimary = jest.fn();
    const createBackup = jest.fn();
    let userId: string;

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
    const deposit = (id: string) =>
        db.selectFrom("naira_deposits")
            .select(["status", "provider", "fee", "feeBearer", "amountToTransfer", "amountReceived", "providerFee", "amountCredited", "ledgerTransactionId", "finalizedAt"])
            .where("id", "=", id)
            .executeTakeFirstOrThrow();
    // A distinct amount per deposit: the same amount would (correctly) reuse the open account.
    let nextAmount = 10000;
    const start = (overrides: { amount?: string; idempotencyKey?: string } = {}) =>
        createNairaDeposit({ userId, amount: overrides.amount ?? `${(nextAmount += 1)}.00`, idempotencyKey: overrides.idempotencyKey ?? randomUUID(), ipAddress: null, userAgent: null });

    beforeAll(async () => {
        const user = await db
            .insertInto("users")
            .values({ phoneNumber: `+23481${Date.now().toString().slice(-8)}`, status: "active", firstName: "Ada", lastName: "Obi" } as never)
            .returning(["id"])
            .executeTakeFirstOrThrow();
        userId = user.id;

        collectionProviderRegistry.reset();
        collectionProviderRegistry.register(makeFakeCollectionProvider({ name: primary, createBankTransfer: createPrimary, getBankTransfer: getPrimary }));
        collectionProviderRegistry.register(makeFakeCollectionProvider({ name: backup, createBankTransfer: createBackup }));
        process.env.NAIRA_COLLECTION_PROVIDERS = `${primary},${backup}`;
    });

    afterAll(async () => {
        delete process.env.NAIRA_COLLECTION_PROVIDERS;
        delete process.env.NAIRA_DEPOSIT_FEE_BEARER;
        await disconnect();
    });

    beforeEach(() => {
        createPrimary.mockReset().mockImplementation(async () => bankTransferCreated({ providerReference: `ref-${randomUUID()}` }));
        getPrimary.mockReset().mockResolvedValue(null);
        createBackup.mockReset();
        delete process.env.NAIRA_DEPOSIT_FEE_BEARER;
    });

    it("issues an account (user pays the fee by default) and credits exactly what was asked once paid", async () => {
        const before = Number(await userBalance());
        const clearingBefore = Number(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, { provider: primary }));

        const { data, isNew } = await start({ amount: "50000.00" });
        expect(isNew).toBe(true);
        expect(createPrimary.mock.calls[0][0]).toMatchObject({ feeBearer: "user", amount: { amount: "50000.00", currency: "NGN" }, customer: { name: "Ada Obi" } });
        expect(data).toMatchObject({ status: "pending", amount: "50000.00", fee: "375.00", amountToTransfer: "50375.00", feeBearer: "user", bankAccount: { accountNumber: "9876543210" } });
        expect(Number(await userBalance())).toBe(before);
        expect(data!.expiresInSeconds).toBeGreaterThan(0);
        await expect(fetchActiveNairaDeposit({ userId })).resolves.toMatchObject({ data: { id: data!.id, status: "pending" } });

        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id }));
        await expect(syncNairaDeposit({ nairaDepositId: data!.id })).resolves.toEqual({ data: { outcome: "credited" } });

        expect(await deposit(data!.id)).toMatchObject({ status: "completed", amountReceived: "50375.00", providerFee: "375.00", amountCredited: "50000.00" });
        expect(Number(await userBalance())).toBe(before + 50000);
        expect(Number(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, { provider: primary }))).toBe(clearingBefore - 50000);
        expect(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_FEES, { provider: primary })).toBe("0");

        // A webhook redelivery or the reconciler never credits twice.
        await expect(syncNairaDeposit({ nairaDepositId: data!.id })).resolves.toEqual({ data: { outcome: "unchanged" } });
        expect(Number(await userBalance())).toBe(before + 50000);
    });

    it("books the fee to provider_fees when Doviz bears it", async () => {
        process.env.NAIRA_DEPOSIT_FEE_BEARER = "doviz";
        createPrimary.mockResolvedValue(bankTransferCreated({ providerReference: `ref-${randomUUID()}`, amountToTransfer: { amount: "20000.00", currency: "NGN" }, fee: { amount: "150.00", currency: "NGN" } }));
        const before = Number(await userBalance());

        const { data } = await start({ amount: "20000.00" });
        expect(data).toMatchObject({ feeBearer: "doviz", amountToTransfer: "20000.00" });

        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id, amountPaid: { amount: "20000.00", currency: "NGN" }, fee: { amount: "150.00", currency: "NGN" } }));
        await syncNairaDeposit({ nairaDepositId: data!.id });

        expect(await deposit(data!.id)).toMatchObject({ status: "completed", amountCredited: "20000.00", providerFee: "150.00" });
        expect(Number(await userBalance())).toBe(before + 20000);
        expect(Number(await balance(LEDGER_ACCOUNT_KIND.PROVIDER_FEES, { provider: primary }))).toBe(-150);
    });

    it("keeps the fee bearer a deposit was created with, even if the toggle flips", async () => {
        createPrimary.mockResolvedValue(bankTransferCreated({ providerReference: `ref-${randomUUID()}`, amountToTransfer: { amount: "1010.00", currency: "NGN" }, fee: { amount: "10.00", currency: "NGN" } }));
        const { data } = await start({ amount: "1000.00" });
        process.env.NAIRA_DEPOSIT_FEE_BEARER = "doviz";
        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id, amountPaid: { amount: "1010.00", currency: "NGN" }, fee: { amount: "10.00", currency: "NGN" } }));
        await syncNairaDeposit({ nairaDepositId: data!.id });
        expect(await deposit(data!.id)).toMatchObject({ feeBearer: "user", amountCredited: "1000.00" });
    });

    it("never under-counts the fee when the provider's lookup reports less than it quoted", async () => {
        createPrimary.mockResolvedValue(bankTransferCreated({ providerReference: `ref-${randomUUID()}`, amountToTransfer: { amount: "153.75", currency: "NGN" }, fee: { amount: "53.75", currency: "NGN" } }));
        const { data } = await start({ amount: "100.00" });
        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id, amountPaid: { amount: "153.75", currency: "NGN" }, fee: { amount: "50.00", currency: "NGN" } }));
        await syncNairaDeposit({ nairaDepositId: data!.id });
        expect(await deposit(data!.id)).toMatchObject({ providerFee: "53.75", amountCredited: "100.00" });
    });

    it("reuses the open account for the same amount, but not for a different one", async () => {
        const first = await start({ amount: "7777.00" });
        const again = await start({ amount: "7777.00" });
        expect(again).toMatchObject({ isNew: false, data: { id: first.data!.id } });
        expect(createPrimary).toHaveBeenCalledTimes(1);

        const other = await start({ amount: "8888.00" });
        expect(other.isNew).toBe(true);
        expect(createPrimary).toHaveBeenCalledTimes(2);
    });

    it("returns the original deposit for a repeated idempotency key", async () => {
        const idempotencyKey = randomUUID();
        const first = await start({ idempotencyKey });
        const second = await start({ idempotencyKey });
        expect(second).toMatchObject({ isNew: false, data: { id: first.data!.id } });
        expect(createPrimary).toHaveBeenCalledTimes(1);
    });

    it("expires an unpaid account, keeps checking it, and still credits a late payment", async () => {
        createPrimary.mockResolvedValue(bankTransferCreated({ providerReference: `ref-${randomUUID()}`, expiresAt: new Date(Date.now() - 1000) }));
        const before = Number(await userBalance());
        const { data } = await start();

        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id, status: "pending", amountPaid: null, fee: null }));
        await expect(syncNairaDeposit({ nairaDepositId: data!.id })).resolves.toEqual({ data: { outcome: "expired" } });
        expect(await deposit(data!.id)).toMatchObject({ status: "expired" });
        const { data: active } = await fetchActiveNairaDeposit({ userId });
        expect(active?.id).not.toBe(data!.id);

        const { data: open } = await fetchOpenNairaDeposits();
        expect(open.map((row) => row.id)).toContain(data!.id);

        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id }));
        await expect(syncNairaDeposit({ nairaDepositId: data!.id })).resolves.toEqual({ data: { outcome: "credited" } });
        expect(Number(await userBalance())).toBe(before + 50000);
    });

    it("marks a failed charge failed without moving money", async () => {
        const before = await userBalance();
        const { data } = await start();
        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id, status: "failed", amountPaid: null, fee: null }));
        await expect(syncNairaDeposit({ nairaDepositId: data!.id })).resolves.toEqual({ data: { outcome: "failed" } });
        expect(await deposit(data!.id)).toMatchObject({ status: "failed", ledgerTransactionId: null });
        expect(await userBalance()).toBe(before);
    });

    it("falls back to the next provider, and fails cleanly when none can issue an account", async () => {
        createPrimary.mockRejectedValue(new CollectionProviderError({ code: "unavailable", status: 503, providerMessage: null }));
        createBackup.mockResolvedValue(bankTransferCreated({ providerReference: `ref-${randomUUID()}` }));
        const { data } = await start();
        expect(await deposit(data!.id)).toMatchObject({ provider: backup });

        createBackup.mockRejectedValue(new CollectionProviderError({ code: "configuration", status: 401, providerMessage: null }));
        await expect(start()).resolves.toEqual({ data: null, failure: "provider_unavailable", isNew: false });
    });

    it("refuses to change a completed deposit's amounts (table guard)", async () => {
        const { data } = await start();
        getPrimary.mockResolvedValue(bankTransferRecord({ externalId: data!.id }));
        await syncNairaDeposit({ nairaDepositId: data!.id });
        await expect(db.updateTable("naira_deposits").set({ amount: "1.00" }).where("id", "=", data!.id).execute()).rejects.toThrow(/immutable|terminal/);
        await expect(db.updateTable("naira_deposits").set({ status: "failed" }).where("id", "=", data!.id).execute()).rejects.toThrow(/terminal/);
    });
});
