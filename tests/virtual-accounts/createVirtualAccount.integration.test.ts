/**
 * Real-Postgres check of account-number creation (skipped by default —
 * DB_INTEGRATION=true). The KYC verifier, file storage and provider are fakes.
 */
import { randomBytes } from "crypto";
import { db, disconnect } from "@/database";
import createUserKyc from "@/actions/userKyc/createUserKyc";
import createVirtualAccount from "@/actions/virtualAccount/createVirtualAccount";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import { resetKycKeyring } from "@/services/kycVault/getKycKeyring";
import { setKycVerifier } from "@/services/kycVerification/getKycVerifier";
import { setVirtualAccountProvider } from "@/services/virtualAccounts/getVirtualAccountProvider";
import { VirtualAccountProviderError } from "@/services/virtualAccounts/virtualAccountProvider";

jest.mock("@/actions/pinVerification/createPinVerification");
// The test fixes which provider issues accounts, whatever the database setting is.
jest.mock("@/actions/nairaFunding/fetchAccountNumberProvider", () => ({ __esModule: true, default: async () => ({ data: "squad" }) }));

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("account numbers against Postgres", () => {
    const createAccount = jest.fn();
    const users: string[] = [];
    const newUser = async (verified = true) => {
        const phone = `+23481${String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, "0")}`;
        const { id } = await db.insertInto("users").values({ phoneNumber: phone, email: `ada${phone.slice(-8)}@example.com`, emailVerifiedAt: new Date(), status: "active" } as never).returning(["id"]).executeTakeFirstOrThrow();
        users.push(id);
        if (verified) {
            const bvn = `2${String(randomBytes(5).readUIntBE(0, 5)).padStart(10, "0").slice(-10)}`;
            await createUserKyc({ userId: id, level: "bvn", values: { bvn, first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", address: "12 Allen Avenue, Ikeja", city: "Lagos" }, pin: "1234", ipAddress: null, userAgent: null });
        }
        return id;
    };
    const accounts = (userId: string) => db.selectFrom("virtual_accounts").selectAll().where("userId", "=", userId).execute();

    beforeAll(async () => {
        process.env.KYC_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;
        process.env.KYC_ENCRYPTION_KEY_VERSION = "1";
        process.env.KYC_BVN_INDEX_KEY = randomBytes(32).toString("base64");
        resetKycKeyring();
        setKycVerifier({ name: "fakeverifier", levels: ["bvn"], verify: async () => ({ outcome: "verified", reason: null, reference: "R", evidence: {} }) });
        setVirtualAccountProvider({ name: "squad", environment: "sandbox", createAccount, verifyWebhook: () => true, parseWebhook: () => null, isWebhookPing: () => false, getDeposit: async () => null });
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
        let next = 1_000_000_000 + Math.floor(Math.random() * 1_000_000);
        createAccount.mockImplementation(async () => ({ accountNumber: String(next++), accountName: "Ada Okafor", bankName: "GTBank", bankCode: "058" }));
    });
    afterAll(async () => {
        setKycVerifier(null);
        setVirtualAccountProvider(null);
        if (users.length) {
            await db.deleteFrom("virtual_accounts").where("userId", "in", users).execute();
            await db.deleteFrom("users").where("id", "in", users).execute();
        }
        await disconnect();
    });

    it("opens the account from the verified KYC, once, and says so", async () => {
        const userId = await newUser();
        const first = await createVirtualAccount({ userId });
        expect(first).toMatchObject({ failure: null, isNew: true, data: { status: "active", account: { accountName: "Ada Okafor", bankName: "GTBank" } } });
        expect(createAccount).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Ada", dateOfBirth: "1994-03-18", gender: "female", email: expect.stringMatching(/@example.com$/), customerRef: expect.stringMatching(/^zk[0-9a-f]{30}$/) }));
        expect(createAccount.mock.calls[0][0].customerRef).not.toContain(userId.replace(/-/g, "").slice(0, 12));

        await expect(createVirtualAccount({ userId })).resolves.toMatchObject({ failure: null, isNew: false });
        expect(createAccount).toHaveBeenCalledTimes(1);
        expect(await accounts(userId)).toHaveLength(1);
        const [audit] = await db.selectFrom("audit_logs").selectAll().where("entityId", "=", (await accounts(userId))[0].id).execute();
        expect(audit).toMatchObject({ action: "wallet.virtual_account.created" });
    });

    it("makes exactly one account when the automatic call and the button race", async () => {
        const userId = await newUser();
        createAccount.mockImplementation(async () => ({ accountNumber: "1234509876", accountName: "Ada Okafor", bankName: "GTBank", bankCode: null }));
        const results = await Promise.all([createVirtualAccount({ userId }), createVirtualAccount({ userId })]);
        expect(results.every((result) => result.failure === null && result.data?.status === "active")).toBe(true);
        expect(await accounts(userId)).toHaveLength(1);
        await db.deleteFrom("virtual_accounts").where("userId", "=", userId).execute();
    });

    it("refuses an unverified user, and maps provider failures without recording anything", async () => {
        const unverified = await newUser(false);
        await expect(createVirtualAccount({ userId: unverified })).resolves.toMatchObject({ failure: "kyc_required", data: null });
        expect(createAccount).not.toHaveBeenCalled();

        const userId = await newUser();
        createAccount.mockRejectedValueOnce(new VirtualAccountProviderError("unavailable", "down"));
        await expect(createVirtualAccount({ userId })).resolves.toMatchObject({ failure: "provider_unavailable" });
        createAccount.mockRejectedValueOnce(new VirtualAccountProviderError("rejected", "no"));
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(createVirtualAccount({ userId })).resolves.toMatchObject({ failure: "virtual_account_refused" });
        expect(await accounts(userId)).toHaveLength(0);
    });
});
