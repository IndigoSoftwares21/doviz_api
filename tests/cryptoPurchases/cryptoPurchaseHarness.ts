import { randomUUID } from "crypto";
import { db } from "@/database";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createCryptoPurchase from "@/actions/cryptoPurchase/createCryptoPurchase";
import cryptoSendProviderRegistry from "@/services/cryptoSends/cryptoSendProviderRegistry";
import { CryptoSendProvider } from "@/services/cryptoSends/cryptoSendProvider";
import { ProviderSend } from "@/services/cryptoSends/types";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

/** A real (valid base58check) TRON address. */
export const TRON_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/** Real-Postgres fixtures: a buyable coin on two fake providers, a rate, funded users. */
export const createHarness = () => {
    const tag = randomUUID().slice(0, 6);
    const symbol = `U${tag}`.toUpperCase();
    const fake = (name: string) => ({
        name,
        environment: "sandbox" as const,
        listSendableAssets: jest.fn().mockResolvedValue([]),
        getBalance: jest.fn().mockResolvedValue(null),
        send: jest.fn(),
        getSend: jest.fn().mockResolvedValue(null),
    });
    const h = { tag, symbol, a: fake(`csa${tag}`), b: fake(`csb${tag}`), assetId: "", userId: "", previousActive: undefined as string | undefined };

    const activate = (name: string) => db.updateTable("provider_settings").set({ activeProvider: name }).where("service", "=", "crypto_sends").execute();
    const balance = async (kind: string, owner: { userId?: string; provider?: string } = {}) => {
        const row = await db.selectFrom("ledger_accounts").select(["balance"]).where("kind", "=", kind).where("currency", "=", "NGN")
            .where("userId", owner.userId ? "=" : "is", owner.userId ?? null).where("provider", owner.provider ? "=" : "is", owner.provider ?? null)
            .executeTakeFirst();
        return row?.balance ?? "0";
    };
    const sent = (externalId: string, overrides: Partial<ProviderSend> = {}): ProviderSend => ({
        externalId, providerReference: `w-${externalId.slice(0, 8)}`, status: "pending", amount: null, fee: null, txHash: null, failureReason: null, ...overrides,
    });
    const setRate = (rate: string, expiresInMs = 3600_000) =>
        db.insertInto("crypto_buy_rates").values({ symbol, currency: "NGN", rate, markupPercent: "0", effectiveFrom: new Date(), expiresAt: new Date(Date.now() + expiresInMs), setBy: "test" }).execute();

    const newUser = async (funds: string) => {
        const user = await db.insertInto("users").values({ phoneNumber: `+23484${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`, status: "active", firstName: "Ada", lastName: "Okafor" } as never)
            .returning(["id"]).executeTakeFirstOrThrow();
        await db.transaction().execute((trx) => createLedgerPosting({
            trx, idempotencyKey: `test-fund-${user.id}`, type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT, description: "Test funding",
            entries: [
                { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: user.id }, amount: funds },
                { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: "testfund" }, amount: `-${funds}` },
            ],
        }));
        return user.id;
    };

    const buy = ({ cryptoAmount = "10", expectedTotal = "16500.00", idempotencyKey = randomUUID(), address = TRON_ADDRESS, userId = h.userId } = {}) =>
        createCryptoPurchase({ userId, assetId: h.assetId, address, memo: null, cryptoAmount, nairaTotal: null, expectedTotal, expectedCryptoAmount: null, idempotencyKey, pin: "4827", ipAddress: null, userAgent: null });

    const row = (id: string) => db.selectFrom("crypto_purchases").select(["status", "provider", "providerReference", "txHash", "totalNaira", "failureReason"]).where("id", "=", id).executeTakeFirstOrThrow();

    const setUp = async () => {
        const asset = await db.insertInto("crypto_assets").values({ symbol, network: "TRC20", name: "Test USDT", decimals: 6, isEnabled: false, isBuyEnabled: true })
            .returning(["id"]).executeTakeFirstOrThrow();
        h.assetId = asset.id;
        for (const provider of [h.a, h.b]) {
            await db.insertInto("crypto_provider_assets").values({
                assetId: asset.id, provider: provider.name, environment: "sandbox", providerAssetId: `${symbol}:trx`, providerCode: symbol, isEnabled: true,
                canSend: true, minSend: "1", sendFee: "1", sendPrecision: 6, memoRequired: false, syncedAt: new Date(),
            }).execute();
        }
        await setRate("1500");
        h.userId = await newUser("50000.00");
        h.previousActive = (await db.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", "crypto_sends").executeTakeFirst())?.activeProvider;
        cryptoSendProviderRegistry.reset();
        cryptoSendProviderRegistry.register(h.a as unknown as CryptoSendProvider);
        cryptoSendProviderRegistry.register(h.b as unknown as CryptoSendProvider);
        await activate(h.a.name);
    };

    const reset = async () => {
        await activate(h.a.name);
        for (const provider of [h.a, h.b]) {
            provider.send.mockReset();
            provider.getSend.mockReset().mockResolvedValue(null);
            provider.getBalance.mockReset().mockResolvedValue(null);
        }
    };

    const tearDown = async () => {
        if (h.previousActive) await activate(h.previousActive);
        cryptoSendProviderRegistry.reset();
    };

    return Object.assign(h, { activate, balance, sent, setRate, newUser, buy, row, setUp, reset, tearDown });
};
