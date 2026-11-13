/**
 * Real-Postgres check of KYC history (skipped by default — DB_INTEGRATION=true).
 */
import { randomBytes } from "crypto";
import { db, disconnect } from "@/database";
import createUserKyc from "@/actions/userKyc/createUserKyc";
import fetchUserKyc from "@/actions/userKyc/fetchUserKyc";
import openUserKyc from "@/actions/userKyc/openUserKyc";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import { resetKycKeyring } from "@/services/kycVault/getKycKeyring";
import { KycDetails } from "@/services/kycVault/types";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("KYC records against Postgres", () => {
    const bvn = `2${Date.now().toString().slice(-10)}`;
    const details: KycDetails = { bvn, firstName: "Ada", middleName: null, lastName: "Okafor", dateOfBirth: "1994-03-18", gender: "female", address: "12 Allen Avenue, Ikeja" };
    const users: string[] = [];
    const newUser = async () => {
        const user = await db.insertInto("users").values({ phoneNumber: `+23481${randomBytes(4).readUInt32BE() % 100_000_000}`, status: "active" } as never).returning(["id"]).executeTakeFirstOrThrow();
        users.push(user.id);
        return user.id;
    };
    const submit = (userId: string, overrides: Partial<KycDetails> = {}) =>
        createUserKyc({ userId, details: { ...details, ...overrides }, pin: "1234", ipAddress: null, userAgent: null });
    const records = (userId: string) => db.selectFrom("kyc_records").selectAll().where("userId", "=", userId).orderBy("submittedAt").execute();
    const audits = (entityId: string, action: string) =>
        db.selectFrom("audit_logs").selectAll().where("entityId", "=", entityId).where("action", "=", action).execute();
    const verify = (recordId: string, userId: string) =>
        db.transaction().execute(async (trx) => {
            await trx.updateTable("kyc_records").set({ status: "verified", decidedAt: new Date(), decidedBy: "test" }).where("id", "=", recordId).execute();
            await trx.updateTable("users").set({ activeKycRecordId: recordId }).where("id", "=", userId).execute();
        });

    beforeAll(() => {
        process.env.KYC_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;
        process.env.KYC_ENCRYPTION_KEY_VERSION = "1";
        process.env.KYC_BVN_INDEX_KEY = randomBytes(32).toString("base64");
        resetKycKeyring();
    });

    beforeEach(() => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
    });

    afterAll(async () => {
        if (users.length) await db.deleteFrom("users").where("id", "in", users).execute();
        await disconnect();
    });

    it("stores a submission encrypted, as its own pending record, and audits it", async () => {
        const userId = await newUser();
        const { failure, recordId } = await submit(userId);
        expect(failure).toBeNull();

        const [record] = await records(userId);
        expect(record).toMatchObject({ id: recordId, status: "pending", level: "bvn", bvnLast4: bvn.slice(-4) });
        expect(JSON.stringify(record)).not.toContain(bvn);
        expect(JSON.stringify(record)).not.toContain("Allen");
        expect(await audits(recordId!, "kyc.submitted")).toHaveLength(1);
        await expect(fetchUserKyc({ userId })).resolves.toMatchObject({ data: { status: "pending", bvn: `•••••••${bvn.slice(-4)}`, recordId: null } });
    });

    it("keeps history: one in review at a time, then verified, then no duplicate verification", async () => {
        const userId = await newUser();
        const { recordId } = await submit(userId, { bvn: `3${bvn.slice(1)}` });
        await expect(submit(userId, { bvn: `3${bvn.slice(1)}` })).resolves.toMatchObject({ failure: "kyc_in_review" });

        await verify(recordId!, userId);
        await expect(fetchUserKyc({ userId })).resolves.toMatchObject({ data: { status: "verified", level: "bvn", recordId } });
        await expect(submit(userId, { bvn: `3${bvn.slice(1)}` })).resolves.toMatchObject({ failure: "kyc_already_verified" });
        expect(await records(userId)).toHaveLength(1);
    });

    it("gives a BVN to one user only", async () => {
        const owner = await newUser();
        const other = await newUser();
        const shared = `4${bvn.slice(1)}`;
        await submit(owner, { bvn: shared });
        await expect(submit(other, { bvn: shared })).resolves.toMatchObject({ failure: "kyc_bvn_in_use", recordId: null });
        expect(await records(other)).toHaveLength(0);
    });

    it("decrypts only through openUserKyc, auditing the purpose first", async () => {
        const userId = await newUser();
        const { recordId } = await submit(userId, { bvn: `5${bvn.slice(1)}` });
        const { data } = await openUserKyc({ recordId: recordId!, purpose: "create_bank_account" });
        expect(data).toMatchObject({ userId, status: "pending", details: { ...details, bvn: `5${bvn.slice(1)}` } });
        const [audit] = await audits(recordId!, "kyc.decrypted");
        expect(audit.metadata).toEqual({ purpose: "create_bank_account", userId });
        await expect(openUserKyc({ recordId: "00000000-0000-4000-8000-000000000000", purpose: "x" })).resolves.toEqual({ data: null });
    });

    it("refuses edits to a record's identity fields and backwards status changes", async () => {
        const userId = await newUser();
        const { recordId } = await submit(userId, { bvn: `6${bvn.slice(1)}` });
        await expect(db.updateTable("kyc_records").set({ bvnEnc: "g1.x.y.z" }).where("id", "=", recordId!).execute()).rejects.toThrow(/append-only/);
        await expect(db.updateTable("kyc_records").set({ bvnLast4: "0000" }).where("id", "=", recordId!).execute()).rejects.toThrow(/append-only/);

        await verify(recordId!, userId);
        await expect(
            db.updateTable("kyc_records").set({ status: "pending", decidedAt: null, decidedBy: null }).where("id", "=", recordId!).execute(),
        ).rejects.toThrow(/cannot go from verified to pending/);
    });
});
