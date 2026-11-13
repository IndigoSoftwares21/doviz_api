/**
 * Real-Postgres check of KYC (skipped by default — DB_INTEGRATION=true).
 * The verifier and file storage are fakes: no money, no network.
 */
import { randomBytes, randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import createUserKyc from "@/actions/userKyc/createUserKyc";
import fetchUserKyc from "@/actions/userKyc/fetchUserKyc";
import openUserKyc from "@/actions/userKyc/openUserKyc";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import { resetKycKeyring } from "@/services/kycVault/getKycKeyring";
import { setKycVerifier } from "@/services/kycVerification/getKycVerifier";
import { setFileStorage } from "@/services/fileStorage/getFileStorage";
import { KycVerification } from "@/services/kycVerification/kycVerifier";
import { selfieDataUri } from "./kycFixtures";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("KYC against Postgres", () => {
    const files = new Map<string, Buffer>();
    const storage = {
        name: "memory",
        put: jest.fn(async ({ bytes }: { bytes: Buffer }) => { const id = randomUUID(); files.set(id, bytes); return { id, url: `mem://${id}` }; }),
        get: jest.fn(async ({ id }: { id: string }) => files.get(id)!),
        remove: jest.fn(async ({ id }: { id: string }) => { files.delete(id); }),
    };
    const decision = (outcome: KycVerification["outcome"], reason: string | null = null): KycVerification => ({ outcome, reason, reference: "REF-1", evidence: { firstName: outcome === "verified" } });
    const verify = jest.fn();
    const bvn = (digit: number) => `${digit}${Date.now().toString().slice(-10)}`;
    const values = { first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", address: "12 Allen Avenue, Ikeja", city: "Lagos" };
    const users: string[] = [];
    const newUser = async () => {
        const phone = `+23481${String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, "0")}`;
        const user = await db.insertInto("users").values({ phoneNumber: phone, status: "active" } as never).returning(["id"]).executeTakeFirstOrThrow();
        users.push(user.id);
        return user.id;
    };
    const submit = (userId: string, submitted: Record<string, string>, level = "bvn_selfie") =>
        createUserKyc({ userId, level, values: level === "bvn_selfie" ? { selfie: selfieDataUri(), ...submitted } : submitted, pin: "1234", ipAddress: null, userAgent: null });
    const fields = (userId: string) => db.selectFrom("kyc_fields").selectAll().where("userId", "=", userId).orderBy("createdAt").execute();
    const records = (userId: string) => db.selectFrom("kyc_records").selectAll().where("userId", "=", userId).orderBy("submittedAt").execute();

    beforeAll(() => {
        process.env.KYC_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;
        process.env.KYC_ENCRYPTION_KEY_VERSION = "1";
        process.env.KYC_BVN_INDEX_KEY = randomBytes(32).toString("base64");
        resetKycKeyring();
        setKycVerifier({ name: "fakeverifier", levels: ["bvn", "bvn_selfie"], verify });
        setFileStorage(storage);
    });
    beforeEach(() => {
        jest.clearAllMocks();
        verify.mockResolvedValue(decision("verified"));
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never);
    });
    afterAll(async () => {
        setKycVerifier(null);
        setFileStorage(null);
        if (users.length) await db.deleteFrom("users").where("id", "in", users).execute();
        await disconnect();
    });

    it("verifies on the spot: encrypted fields, encrypted selfie evidence, the attempt in force", async () => {
        const userId = await newUser();
        const theBvn = bvn(2);
        const { failure, recordId } = await submit(userId, { bvn: theBvn, ...values });
        expect(failure).toBeNull();
        expect(verify).toHaveBeenCalledWith(expect.objectContaining({ level: "bvn_selfie", contact: { phoneNumber: expect.stringMatching(/^\+234/) }, values: expect.objectContaining({ bvn: theBvn, selfie: expect.stringMatching(/^data:image\/jpeg/) }) }));

        const stored = await fields(userId);
        expect(JSON.stringify(stored)).not.toMatch(new RegExp(`${theBvn}|Allen|Okafor|mem://`));
        const [blob] = [...files.values()];
        expect(blob.toString("utf8")).not.toContain("data:image");
        expect(await records(userId)).toEqual([expect.objectContaining({ id: recordId, status: "verified", decidedBy: "fakeverifier", providerReference: "REF-1", evidence: { firstName: true } })]);
        await expect(fetchUserKyc({ userId })).resolves.toMatchObject({ data: { status: "verified", level: "bvn_selfie", recordId, bvn: `•••••••${theBvn.slice(-4)}` } });
        await expect(openUserKyc({ recordId: recordId!, purpose: "test" })).resolves.toMatchObject({ data: { values: { bvn: theBvn, last_name: "Okafor" } } });
    });

    it("rejects with a reason; the failed details are kept as history but NOT on file, so the retry sends them again", async () => {
        const userId = await newUser();
        const theBvn = bvn(3);
        verify.mockResolvedValueOnce(decision("rejected", "Your date of birth doesn't match your BVN."));
        const first = await submit(userId, { bvn: theBvn, ...values });
        await expect(fetchUserKyc({ userId })).resolves.toMatchObject({ data: { status: "rejected", rejectionReason: "Your date of birth doesn't match your BVN." } });

        // Nothing from a rejected attempt is reused: leaving fields out isn't enough to verify.
        await expect(submit(userId, { date_of_birth: "1994-03-19" })).rejects.toThrow(/missing required fields/);

        const second = await submit(userId, { bvn: theBvn, ...values, date_of_birth: "1994-03-19" });
        expect(second.failure).toBeNull();
        expect(verify).toHaveBeenLastCalledWith(expect.objectContaining({ level: "bvn_selfie", values: expect.objectContaining({ bvn: theBvn, date_of_birth: "1994-03-19" }) }));
        expect((await records(userId)).map((record) => record.status)).toEqual(["rejected", "verified"]);
        // The failed attempt still shows exactly what it checked.
        await expect(openUserKyc({ recordId: first.recordId!, purpose: "test" })).resolves.toMatchObject({ data: { values: { date_of_birth: "1994-03-18" } } });
    });

    it("reuses only VERIFIED details: a later attempt (e.g. an upgrade) may leave them out", async () => {
        const userId = await newUser();
        const theBvn = bvn(8);
        await submit(userId, { bvn: theBvn, ...values }, "bvn");
        verify.mockClear();
        const upgrade = await submit(userId, {}, "bvn_selfie");
        expect(upgrade.failure).toBeNull();
        expect(verify).toHaveBeenCalledWith(expect.objectContaining({ level: "bvn_selfie", values: expect.objectContaining({ bvn: theBvn, address: values.address, selfie: expect.any(String) }) }));
        expect((await records(userId)).map((record) => record.status)).toEqual(["superseded", "verified"]);
    });

    it("records nothing and removes the evidence when the verifier can't answer", async () => {
        const userId = await newUser();
        verify.mockResolvedValueOnce(decision("unavailable"));
        await expect(submit(userId, { bvn: bvn(4), ...values })).resolves.toMatchObject({ failure: "provider_unavailable" });
        expect(await fields(userId)).toHaveLength(0);
        expect(await records(userId)).toHaveLength(0);
        expect(storage.remove).toHaveBeenCalledTimes(1);
    });

    it("refuses another user's BVN before paying for a check; a rejection releases the BVN for its owner", async () => {
        const owner = await newUser();
        const intruder = await newUser();
        const shared = bvn(5);
        verify.mockResolvedValueOnce(decision("rejected", "Your name doesn't match your BVN."));
        await submit(intruder, { bvn: shared, ...values });
        await expect(submit(owner, { bvn: shared, ...values })).resolves.toMatchObject({ failure: null });

        verify.mockClear();
        await expect(submit(intruder, { bvn: shared, ...values })).resolves.toMatchObject({ failure: "kyc_identifier_in_use", fieldKey: "bvn" });
        expect(verify).not.toHaveBeenCalled();
    });

    it("won't verify twice at the same level", async () => {
        const userId = await newUser();
        await submit(userId, { bvn: bvn(6), ...values });
        verify.mockClear();
        await expect(submit(userId, { address: "1 New Road, Yaba" })).resolves.toMatchObject({ failure: "kyc_already_verified" });
        expect(verify).not.toHaveBeenCalled();
    });

    it("refuses edits to stored values, links, and backwards status changes", async () => {
        const userId = await newUser();
        const { recordId } = await submit(userId, { bvn: bvn(7), ...values });
        const [field] = await fields(userId);
        await expect(db.updateTable("kyc_fields").set({ valueEnc: "g1.x.y.z" }).where("id", "=", field.id).execute()).rejects.toThrow(/append-only/);
        await expect(db.updateTable("kyc_record_fields").set({ fieldKey: "x" }).where("recordId", "=", recordId!).execute()).rejects.toThrow(/insert-only/);
        await expect(db.updateTable("kyc_records").set({ status: "rejected", rejectionReason: "x" }).where("id", "=", recordId!).execute()).rejects.toThrow(/cannot go from verified to rejected/);
    });
});
