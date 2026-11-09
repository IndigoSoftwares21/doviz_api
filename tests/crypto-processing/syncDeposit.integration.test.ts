/**
 * Real-Postgres check of the deposit money path (skipped by default).
 * Run against a DISPOSABLE, fully migrated database — rows can't be deleted
 * (money tables block deletes), so never point this at a shared database:
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/crypto-processing/syncDeposit.integration.test.ts
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import syncDeposit from "@/actions/deposit/syncDeposit";
import providerRegistry from "@/services/crypto/providerRegistry";
import { depositRecord, makeFakeProvider } from "./fakeProvider";

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("syncDeposit against Postgres", () => {
    const tag = randomUUID().slice(0, 8);
    const address = `T${tag}`;
    const providerCode = `USDT_${tag}`;
    let userId: string;

    beforeAll(async () => {
        const user = await db.insertInto("users").values({ phoneNumber: `+23480${Date.now().toString().slice(-8)}`, status: "active" } as never)
            .returning(["id"]).executeTakeFirstOrThrow();
        userId = user.id;
        const asset = await db.insertInto("crypto_assets").values({ symbol: `T${tag}`, network: "TRC20", name: "Test", decimals: 6, isEnabled: true })
            .returning(["id"]).executeTakeFirstOrThrow();
        await db.insertInto("crypto_provider_assets").values({
            assetId: asset.id, provider: "fakepay", environment: "sandbox", providerAssetId: `id-${tag}`, providerCode,
            minDeposit: null, confirmations: 1, isEnabled: true, syncedAt: null,
        }).execute();
        await db.insertInto("conversion_markups").values({ assetId: asset.id, currency: "NGN", markupPercent: "2.5", note: null }).execute();
        await db.insertInto("crypto_wallets").values({
            userId, assetId: asset.id, provider: "fakepay", label: `dvz-${tag}`, status: "active", isPrimary: true,
            address, providerWalletId: `w-${tag}`, activatedAt: new Date(), retiredAt: null,
        }).execute();

        providerRegistry.reset();
        providerRegistry.register(makeFakeProvider({
            getDeposit: jest.fn().mockResolvedValue(depositRecord({ reference: `trade-${tag}`, address, providerCode, grossNgn: "160000" })),
        }));
    });

    afterAll(() => disconnect());

    it("credits exactly once, even when two syncs race", async () => {
        const args = { provider: "fakepay", reference: `trade-${tag}` };
        const outcomes = await Promise.all([syncDeposit(args), syncDeposit(args)]);
        const again = await syncDeposit(args);

        expect(outcomes.map((o) => o.data.outcome).sort()).toEqual(["credited", "unchanged"]);
        expect(again.data.outcome).toBe("unchanged");

        const deposit = await db.selectFrom("crypto_deposits").select(["status", "grossNgn", "markupNgn", "netNgn"])
            .where("providerReference", "=", args.reference).executeTakeFirstOrThrow();
        expect(deposit).toEqual({ status: "completed", grossNgn: "160000.00", markupNgn: "4000.00", netNgn: "156000.00" });

        const account = await db.selectFrom("ledger_accounts").select(["balance"])
            .where("kind", "=", "user_available").where("userId", "=", userId).executeTakeFirstOrThrow();
        expect(account.balance).toBe("156000.00");
    });
});
