import axios from "axios";
import KorapayKycVerifier from "@/services/kycVerification/providers/korapay/korapayKycVerifier";
import decideKorapayBvn from "@/services/kycVerification/providers/korapay/decideKorapayBvn";

jest.mock("axios");

const values = { bvn: "22212345678", first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", selfie: "data:image/jpeg;base64,AAAA" };
const match = (ok = true) => ({ value: "x", match: ok });
const record = (overrides: Record<string, unknown> = {}) => ({
    reference: "KPY-ID-1",
    gender: "Female",
    validation: { first_name: match(), last_name: match(), date_of_birth: match(), selfie: { ...match(), confidence_rating: 94 } },
    ...overrides,
});

describe("Korapay BVN decision", () => {
    it("verifies only when every requested check matches, keeping match results as evidence", () => {
        expect(decideKorapayBvn({ record: record(), gender: "female", withSelfie: true })).toEqual({
            outcome: "verified",
            reason: null,
            reference: "KPY-ID-1",
            evidence: { firstName: true, lastName: true, dateOfBirth: true, gender: true, selfie: true, selfieConfidence: 94 },
        });
    });

    it.each([
        ["name", { first_name: match(false) }, /name doesn't match/],
        ["date of birth", { date_of_birth: match(false) }, /date of birth/],
        ["selfie", { selfie: { match: false, confidence_rating: 31 } }, /selfie doesn't match/],
        ["a missing selfie result", { selfie: null }, /selfie doesn't match/],
    ])("rejects on a %s mismatch with a reason the user can act on", (_what, validation, reason) => {
        const decided = decideKorapayBvn({ record: record({ validation: { ...record().validation, ...validation } }), gender: "female", withSelfie: true });
        expect(decided.outcome).toBe("rejected");
        expect(decided.reason).toMatch(reason);
    });

    it("rejects a gender that doesn't match the BVN record, and ignores the selfie when not asked", () => {
        expect(decideKorapayBvn({ record: record(), gender: "male", withSelfie: true }).reason).toMatch(/gender/);
        expect(decideKorapayBvn({ record: record({ validation: { ...record().validation, selfie: null } }), gender: "female", withSelfie: false })).toMatchObject({
            outcome: "verified",
            evidence: { selfie: null, selfieConfidence: null },
        });
    });
});

describe("Korapay KYC verifier", () => {
    const verifier = new KorapayKycVerifier("sk_test_x", "https://korapay.test/merchant/api/v1");
    const reply = (status: number, data: unknown) => jest.mocked(axios.post).mockResolvedValue({ status, data });

    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(console, "info").mockImplementation(() => undefined);
    });

    it("sends the BVN with consent, the details and the selfie for matching", async () => {
        reply(200, { status: true, data: record() });
        await expect(verifier.verify({ level: "bvn_selfie", values })).resolves.toMatchObject({ outcome: "verified" });
        expect(axios.post).toHaveBeenCalledWith(
            "https://korapay.test/merchant/api/v1/identities/ng/bvn",
            { id: values.bvn, verification_consent: true, validation: { first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", selfie: values.selfie } },
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer sk_test_x" }) }),
        );
    });

    it("leaves the selfie out at the bvn level", async () => {
        reply(200, { status: true, data: record() });
        await verifier.verify({ level: "bvn", values });
        expect(jest.mocked(axios.post).mock.calls[0][1]).toEqual(expect.objectContaining({ validation: expect.not.objectContaining({ selfie: expect.anything() }) }));
    });

    it("rejects a BVN Korapay can't find", async () => {
        reply(404, { status: false, message: "BVN not found" });
        await expect(verifier.verify({ level: "bvn", values })).resolves.toMatchObject({ outcome: "rejected", reason: expect.stringMatching(/couldn't find this BVN/) });
    });

    it.each([
        ["our key refused", 401, { status: false, message: "Unauthorized" }],
        ["an outage", 503, {}],
        ["rate limiting", 429, {}],
        ["an unexplained refusal", 400, { status: false, message: "Something odd" }],
    ])("never rejects the user for %s — the check is unavailable", async (_why, status, data) => {
        reply(status, data);
        await expect(verifier.verify({ level: "bvn", values })).resolves.toMatchObject({ outcome: "unavailable" });
    });

    it("treats a network failure as unavailable", async () => {
        jest.mocked(axios.post).mockRejectedValue(new Error("ECONNRESET"));
        await expect(verifier.verify({ level: "bvn", values })).resolves.toMatchObject({ outcome: "unavailable" });
    });
});
