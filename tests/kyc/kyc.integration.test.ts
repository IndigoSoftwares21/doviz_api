/**
 * Real-Postgres check of field-level KYC (skipped by default — DB_INTEGRATION=true).
 */
import { randomBytes } from "crypto";
import { db, disconnect } from "@/database";
import createUserKyc from "@/actions/userKyc/createUserKyc";
import fetchUserKyc from "@/actions/userKyc/fetchUserKyc";
import openUserKyc from "@/actions/userKyc/openUserKyc";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import { resetKycKeyring } from "@/services/kycVault/getKycKeyring";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("KYC against Postgres", () => {
    const bvn = (digit: number) => `${digit}${Date.now().toString().slice(-10)}`;
    const values = { first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", address: "12 Allen Avenue, Ikeja" };
    const users: string[] = [];
    const newUser = async () => {
        const phone = `+23481${String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, "0")}`;
        const user = await db.insertInto("users").values({ phoneNumber: phone, status: "active" } as never).returning(["id"]).executeTakeFirstOrThrow();
        users.push(user.id);
        return user.id;
    };
    const submit = (userId: string, submitted: Record<string, string>) => createUserKyc({ userId, level: "bvn", values: submitted, pin: "1234", ipAddress: null, userAgent: null });
    const fields = (userId: string) => db.selectFrom("kyc_fields").selectAll().where("userId", "=", userId).orderBy("createdAt").execute();
    const decide = (recordId: string, userId: string, status: "verified" | "rejected") =>
        db.transaction().execute(async (trx) => {
            await trx.updateTable("kyc_records").set({ status, decidedAt: new Date(), decidedBy: "test", rejectionReason: status === "rejected" ? "No match" : null }).where("id", "=", recordId).execute();
            if (status === "verified") await trx.updateTable("users").set({ activeKycRecordId: recordId }).where("id", "=", userId).execute();
        });

    beforeAll(() => {
        process.env.KYC_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;
        process.env.KYC_ENCRYPTION_KEY_VERSION = "1";
        process.env.KYC_BVN_INDEX_KEY = randomBytes(32).toString("base64");
        resetKycKeyring();
    });
    beforeEach(() => jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never));
    afterAll(async () => {
        if (users.length) await db.deleteFrom("users").where("id", "in", users).execute();
        await disconnect();
    });

    it("stores each value as its own encrypted field, linked to a pending attempt", async () => {
        const userId = await newUser();
        const theBvn = bvn(2);
        const { failure, recordId } = await submit(userId, { bvn: theBvn, ...values });
        expect(failure).toBeNull();

        const stored = await fields(userId);
        expect(stored.map((field) => field.fieldKey).sort()).toEqual(["address", "bvn", "date_of_birth", "first_name", "gender", "last_name"]);
        expect(JSON.stringify(stored)).not.toMatch(new RegExp(`${theBvn}|Allen|1994-03-18|Okafor`));
        expect(stored.find((field) => field.fieldKey === "bvn")).toMatchObject({ displayHint: theBvn.slice(-4), lookupIndex: expect.stringMatching(/^[0-9a-f]{64}$/) });
        const linked = await db.selectFrom("kyc_record_fields").selectAll().where("recordId", "=", recordId!).execute();
        expect(linked).toHaveLength(6);
        await expect(fetchUserKyc({ userId })).resolves.toMatchObject({ data: { status: "pending", bvn: `•••••••${theBvn.slice(-4)}` } });
    });

    it("reuses what's on file: a retry after rejection only sends what changed, and history is kept", async () => {
        const userId = await newUser();
        const theBvn = bvn(3);
        const first = await submit(userId, { bvn: theBvn, ...values });
        await decide(first.recordId!, userId, "rejected");

        const second = await submit(userId, { last_name: "Okafor-Eze" });
        expect(second.failure).toBeNull();
        const { data } = await openUserKyc({ recordId: second.recordId!, purpose: "test" });
        expect(data?.values).toEqual({ bvn: theBvn, ...values, last_name: "Okafor-Eze" });

        const lastNames = (await fields(userId)).filter((field) => field.fieldKey === "last_name");
        expect(lastNames).toHaveLength(2);
        expect(lastNames[0].supersededAt).not.toBeNull();
        // The first attempt still points at what it actually checked.
        await expect(openUserKyc({ recordId: first.recordId!, purpose: "test" })).resolves.toMatchObject({ data: { values: { last_name: "Okafor" } } });
    });

    it("allows one attempt in review, then none once verified at that level", async () => {
        const userId = await newUser();
        const { recordId } = await submit(userId, { bvn: bvn(4), ...values });
        await expect(submit(userId, { address: "1 New Road, Yaba" })).resolves.toMatchObject({ failure: "kyc_in_review" });
        await decide(recordId!, userId, "verified");
        await expect(fetchUserKyc({ userId })).resolves.toMatchObject({ data: { status: "verified", level: "bvn", recordId } });
        await expect(submit(userId, { address: "1 New Road, Yaba" })).resolves.toMatchObject({ failure: "kyc_already_verified" });
    });

    it("gives an identifier to one user, and rolls back everything when refused", async () => {
        const owner = await newUser();
        const other = await newUser();
        const shared = bvn(5);
        await submit(owner, { bvn: shared, ...values });
        await expect(submit(other, { ...values, bvn: shared })).resolves.toMatchObject({ failure: "kyc_identifier_in_use", fieldKey: "bvn" });
        expect(await fields(other)).toHaveLength(0);
        expect(await db.selectFrom("kyc_records").select("id").where("userId", "=", other).execute()).toHaveLength(0);
    });

    it("audits every decrypt with its purpose and fields, before decrypting", async () => {
        const userId = await newUser();
        const { recordId } = await submit(userId, { bvn: bvn(6), ...values });
        await openUserKyc({ recordId: recordId!, purpose: "create_bank_account" });
        const [audit] = await db.selectFrom("audit_logs").selectAll().where("entityId", "=", recordId!).where("action", "=", "kyc.decrypted").execute();
        expect(audit.metadata).toMatchObject({ purpose: "create_bank_account", userId, fields: expect.arrayContaining(["bvn", "address"]) });
        await expect(openUserKyc({ recordId: "00000000-0000-4000-8000-000000000000", purpose: "x" })).resolves.toEqual({ data: null });
    });

    it("refuses edits to stored values, links, and backwards status changes", async () => {
        const userId = await newUser();
        const { recordId } = await submit(userId, { bvn: bvn(7), ...values });
        const [field] = await fields(userId);
        await expect(db.updateTable("kyc_fields").set({ valueEnc: "g1.x.y.z" }).where("id", "=", field.id).execute()).rejects.toThrow(/append-only/);
        await expect(db.updateTable("kyc_record_fields").set({ fieldKey: "x" }).where("recordId", "=", recordId!).execute()).rejects.toThrow(/insert-only/);
        await decide(recordId!, userId, "verified");
        await expect(
            db.updateTable("kyc_records").set({ status: "pending", decidedAt: null, decidedBy: null }).where("id", "=", recordId!).execute(),
        ).rejects.toThrow(/cannot go from verified to pending/);
    });
});
