/**
 * Real-Postgres check of crediting payments into account numbers (skipped by
 * default — DB_INTEGRATION=true). Providers are fakes.
 */
import { randomBytes } from "crypto";
import { db, disconnect } from "@/database";
import syncAccountDeposit from "@/actions/accountDeposit/syncAccountDeposit";
import { setVirtualAccountProvider } from "@/services/virtualAccounts/getVirtualAccountProvider";
import { ProviderAccountDeposit } from "@/services/virtualAccounts/virtualAccountProvider";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";
import runAccountSweep from "@/actions/accountSweep/runAccountSweep";

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("crediting account-number payments against Postgres", () => {
    const users: string[] = [];
    const deposits = new Map<string, ProviderAccountDeposit | null>();
    const fakeProvider = (name: string) => ({
        name, environment: "production" as const,
        createAccount: jest.fn(), verifyWebhook: () => true, parseWebhook: () => null, isWebhookPing: () => false,
        getDeposit: jest.fn(async ({ reference }: { reference: string }) => deposits.get(reference) ?? null),
    });
    const sweepToPool = jest.fn(async () => undefined);
    const fossapay = { ...fakeProvider("fossapay"), sweepToPool };
    const squad = fakeProvider("squad");
    const number = () => String(1_000_000_000 + (randomBytes(4).readUInt32BE() % 8_999_999_999)).slice(0, 10);

    const userWithAccount = async (provider: string) => {
        const phone = `+23481${String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, "0")}`;
        const { id } = await db.insertInto("users").values({ phoneNumber: phone, status: "active" } as never).returning(["id"]).executeTakeFirstOrThrow();
        users.push(id);
        const kyc = await db.insertInto("kyc_records").values({ userId: id, status: "verified", level: "bvn", decidedAt: new Date(), decidedBy: "test" }).returning(["id"]).executeTakeFirstOrThrow();
        const accountNumber = number();
        await db.insertInto("virtual_accounts").values({ userId: id, kycRecordId: kyc.id, provider, environment: "production", customerRef: `zk${randomBytes(8).toString("hex")}`, accountNumber, accountName: "Ada Okafor", bankName: "Bank", bankCode: null, status: "active" }).execute();
        return { userId: id, accountNumber };
    };
    const payment = (accountNumber: string, extra: Partial<ProviderAccountDeposit> = {}): ProviderAccountDeposit => ({
        reference: `txn_${randomBytes(6).toString("hex")}`, accountNumber, status: "completed",
        amount: { amount: "5000.00", currency: "NGN" }, fee: { amount: "50.00", currency: "NGN" }, paidAt: new Date(),
        sender: { name: "JOHN DOE", bankName: "GTBank", bankCode: null, accountNumber: "******6789" }, ...extra,
    });
    const balance = async (userId: string) => {
        const row = await db.selectFrom("ledger_accounts").select(["balance"] as never).where("kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE).where("userId", "=", userId).executeTakeFirst();
        return (row as { balance?: string } | undefined)?.balance ?? "0.00";
    };

    beforeAll(() => {
        setVirtualAccountProvider(fossapay);
        setVirtualAccountProvider(squad);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterAll(async () => {
        setVirtualAccountProvider(null);
        if (users.length) {
            await db.deleteFrom("virtual_accounts").where("userId", "in", users).execute();
            await db.deleteFrom("account_sweeps").where("provider", "in", ["fossapay", "squad"]).where("depositReference", "like", "txn_%").execute();
        }
        await disconnect();
    });

    it("credits a payment once (fee borne by the user), however many webhooks arrive, and records the sender", async () => {
        const { userId, accountNumber } = await userWithAccount("fossapay");
        const paid = payment(accountNumber);
        deposits.set(paid.reference, paid);

        await expect(syncAccountDeposit({ provider: "fossapay", reference: paid.reference })).resolves.toEqual({ data: { outcome: "credited" } });
        await expect(syncAccountDeposit({ provider: "fossapay", reference: paid.reference })).resolves.toEqual({ data: { outcome: "unchanged" } });

        const rows = await db.selectFrom("naira_deposits").selectAll().where("providerReference", "=", paid.reference).execute();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ userId, provider: "fossapay", status: "completed", amountReceived: "5000.00", providerFee: "50.00", amountCredited: "4950.00", senderName: "JOHN DOE", accountNumber });
        expect(await balance(userId)).toBe("4950.00");
    });

    it("moves each credited Fossapay deposit (net of fee) into the pool once, retrying a failed attempt", async () => {
        const { accountNumber } = await userWithAccount("fossapay");
        const paid = payment(accountNumber, { amount: { amount: "500.00", currency: "NGN" }, fee: { amount: "5.00", currency: "NGN" } });
        deposits.set(paid.reference, paid);
        sweepToPool.mockClear();
        sweepToPool.mockRejectedValueOnce(new Error("Fossapay down"));

        await syncAccountDeposit({ provider: "fossapay", reference: paid.reference });
        const [sweep] = await db.selectFrom("account_sweeps").selectAll().where("depositReference", "=", paid.reference).execute();
        expect(sweep).toMatchObject({ provider: "fossapay", fromAccount: accountNumber, amount: "495.00", status: "pending", attempts: 1, lastError: "Fossapay down" });
        expect(sweep.reference).toMatch(/^sw[0-9a-f]{30}$/);

        await expect(runAccountSweep({ id: sweep.id })).resolves.toEqual({ data: { status: "completed" } });
        expect(sweepToPool).toHaveBeenLastCalledWith({ fromAccount: accountNumber, amount: "495.00", reference: sweep.reference });
        await expect(runAccountSweep({ id: sweep.id })).resolves.toEqual({ data: { status: "completed" } });
        expect(sweepToPool).toHaveBeenCalledTimes(2); // the failed try + the one that worked — never a third

        await syncAccountDeposit({ provider: "fossapay", reference: paid.reference });
        expect(await db.selectFrom("account_sweeps").select("id").where("depositReference", "=", paid.reference).execute()).toHaveLength(1);
    });

    it("never sweeps for a provider that settles to us itself (Squad)", async () => {
        const { accountNumber } = await userWithAccount("squad");
        const paid = payment(accountNumber);
        deposits.set(paid.reference, paid);
        await syncAccountDeposit({ provider: "squad", reference: paid.reference });
        expect(await db.selectFrom("account_sweeps").select("id").where("depositReference", "=", paid.reference).execute()).toHaveLength(0);
    });

    it("keeps crediting a Squad account after Fossapay became the active provider — each account's own provider is asked", async () => {
        const { userId, accountNumber } = await userWithAccount("squad");
        const paid = payment(accountNumber, { amount: { amount: "1000.00", currency: "NGN" }, fee: null });
        deposits.set(paid.reference, paid);
        await expect(syncAccountDeposit({ provider: "squad", reference: paid.reference })).resolves.toEqual({ data: { outcome: "credited" } });
        expect(squad.getDeposit).toHaveBeenCalledWith({ reference: paid.reference });
        expect(await balance(userId)).toBe("1000.00");
    });

    it("retries (throws) while the provider can't show the payment yet, and ignores a failed one or an unknown account", async () => {
        const { userId, accountNumber } = await userWithAccount("fossapay");
        const pending = payment(accountNumber, { status: "pending" });
        deposits.set(pending.reference, pending);
        await expect(syncAccountDeposit({ provider: "fossapay", reference: pending.reference })).rejects.toThrow(/will retry/);
        await expect(syncAccountDeposit({ provider: "fossapay", reference: "txn_not_there_yet" })).rejects.toThrow(/not found/);

        const failed = payment(accountNumber, { status: "failed" });
        deposits.set(failed.reference, failed);
        await expect(syncAccountDeposit({ provider: "fossapay", reference: failed.reference })).resolves.toEqual({ data: { outcome: "ignored" } });

        const stray = payment("9999999999");
        deposits.set(stray.reference, stray);
        await expect(syncAccountDeposit({ provider: "fossapay", reference: stray.reference })).resolves.toEqual({ data: { outcome: "ignored" } });
        expect(await balance(userId)).toBe("0.00");
    });
});
