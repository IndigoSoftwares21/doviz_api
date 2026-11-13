/**
 * Real-Postgres check of sending to someone else's bank account (skipped by default — DB_INTEGRATION=true).
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createWithdrawal from "@/actions/withdrawal/createWithdrawal";
import fetchWithdrawalQuote from "@/actions/withdrawalQuote/fetchWithdrawalQuote";
import fetchWithdrawal from "@/actions/withdrawal/fetchWithdrawal";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import payoutProviderRegistry from "@/services/payouts/payoutProviderRegistry";
import PayoutProviderError from "@/services/payouts/payoutProviderError";
import { PayoutProvider } from "@/services/payouts/payoutProvider";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("sending to someone else's bank account, against Postgres", () => {
    const tag = randomUUID().slice(0, 6);
    const provider = {
        name: `po${tag}`, environment: "sandbox" as const,
        listBanks: jest.fn(), getPayout: jest.fn(), getBalance: jest.fn().mockResolvedValue(null),
        resolveAccount: jest.fn(), sendPayout: jest.fn(),
    };
    let userId: string;
    let bankId: string;
    let previous: { payouts?: string; toOthers?: string } = {};
    const setToOthers = (value: "on" | "off") =>
        db.insertInto("app_settings").values({ key: "bank_transfers_to_others", value }).onConflict((oc) => oc.column("key").doUpdateSet({ value })).execute();
    const userBalance = async () =>
        (await db.selectFrom("ledger_accounts").select(["balance"]).where("kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE).where("userId", "=", userId).executeTakeFirst())?.balance ?? "0";
    const destination = { payoutBankId: "", accountNumber: "0987654321" };
    const send = (narration: string | null, expectedTotal = "1020.00") =>
        createWithdrawal({ userId, destination: { ...destination, payoutBankId: bankId }, narration, amount: "1000.00", expectedTotal, idempotencyKey: randomUUID(), pin: "4827", ipAddress: null, userAgent: null });

    beforeAll(async () => {
        previous = {
            payouts: (await db.selectFrom("provider_settings").select(["activeProvider"]).where("service", "=", "payouts").executeTakeFirst())?.activeProvider,
            toOthers: (await db.selectFrom("app_settings").select(["value"]).where("key", "=", "bank_transfers_to_others").executeTakeFirst())?.value,
        };
        payoutProviderRegistry.register(provider as unknown as PayoutProvider);
        await db.updateTable("provider_settings").set({ activeProvider: provider.name }).where("service", "=", "payouts").execute();
        await db.insertInto("payout_fee_defaults" as never).values({ provider: provider.name, environment: "sandbox", currency: "NGN", fixedFee: "20.00", vatPercent: "0" } as never).execute().catch(() => undefined);
        const bank = await db.insertInto("payout_banks").values({ name: `Recipient Bank ${tag}`, slug: `recipient-bank-${tag}`, code: null, isEnabled: true }).returning(["id"]).executeTakeFirstOrThrow();
        bankId = bank.id;
        await db.insertInto("provider_banks").values({ payoutBankId: bankId, provider: provider.name, environment: "sandbox", providerBankId: "999" }).execute();
        const user = await db.insertInto("users").values({ phoneNumber: `+23484${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`, status: "active", firstName: "Ada", lastName: "Okafor" } as never).returning(["id"]).executeTakeFirstOrThrow();
        userId = user.id;
        await db.transaction().execute((trx) => createLedgerPosting({
            trx, idempotencyKey: `test-fund-${userId}`, type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT, description: "Test funding",
            entries: [
                { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: "5000.00" },
                { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: "testfund" }, amount: "-5000.00" },
            ],
        }));
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
        provider.resolveAccount.mockResolvedValue({ accountName: "CHIDI EZE" });
        provider.sendPayout.mockImplementation(async ({ externalId }) => ({ externalId, providerReference: "pr-1", status: "pending", amount: { amount: "1000.00", currency: "NGN" }, fee: null, failureReason: null }));
    });
    afterAll(async () => {
        if (previous.payouts) await db.updateTable("provider_settings").set({ activeProvider: previous.payouts }).where("service", "=", "payouts").execute();
        await setToOthers((previous.toOthers as "on" | "off") ?? "off");
        await disconnect();
    });

    it("refuses while the setting is off, holding nothing", async () => {
        await setToOthers("off");
        const before = await userBalance();
        await expect(fetchWithdrawalQuote({ userId, destination: { ...destination, payoutBankId: bankId }, amount: "1000.00" })).resolves.toMatchObject({ data: null, failure: "transfers_to_others_off" });
        await expect(send(null)).resolves.toMatchObject({ data: null, failure: "transfers_to_others_off" });
        expect(provider.resolveAccount).not.toHaveBeenCalled();
        expect(await userBalance()).toBe(before);
    });

    it("sends to the name the bank returns, with the user's narration, and shows both on the withdrawal", async () => {
        await setToOthers("on");
        const quote = await fetchWithdrawalQuote({ userId, destination: { ...destination, payoutBankId: bankId }, amount: "1000.00" });
        expect(quote.data?.account).toMatchObject({ bankAccountId: null, accountName: "CHIDI EZE", accountNumber: "0987654321", providerBankId: "999" });

        const { data, failure } = await send("Rent for May", quote.data!.totalHeld);
        expect(failure).toBeNull();
        expect(provider.sendPayout).toHaveBeenCalledWith(expect.objectContaining({ providerBankId: "999", accountNumber: "0987654321", accountName: "CHIDI EZE", narration: "Rent for May" }));
        const stored = await db.selectFrom("bank_withdrawals").selectAll().where("id", "=", data!.id).executeTakeFirstOrThrow();
        expect(stored).toMatchObject({ bankAccountId: null, recipientPayoutBankId: bankId, recipientAccountNumber: "0987654321", recipientAccountName: "CHIDI EZE", narration: "Rent for May" });
        await expect(fetchWithdrawal({ userId, withdrawalId: data!.id })).resolves.toMatchObject({
            data: { toSomeoneElse: true, narration: "Rent for May", bankAccount: { id: null, accountName: "CHIDI EZE", accountNumber: "0987654321" } },
        });

        // The destination can never be changed afterwards.
        await expect(db.updateTable("bank_withdrawals").set({ recipientAccountNumber: "1111111111" }).where("id", "=", data!.id).execute()).rejects.toThrow(/cannot change/);
    });

    it("refuses an account the bank doesn't know before any money moves", async () => {
        await setToOthers("on");
        provider.resolveAccount.mockRejectedValue(new PayoutProviderError({ code: "rejected", status: 400, providerMessage: "Account not found" }));
        const before = await userBalance();
        await expect(send(null)).resolves.toMatchObject({ data: null, failure: "recipient_account_not_found" });
        expect(provider.sendPayout).not.toHaveBeenCalled();
        expect(await userBalance()).toBe(before);
    });
});
