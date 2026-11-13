import IdentifyOrgKycVerifier from "@/services/kycVerification/providers/identifyorg/identifyOrgKycVerifier";
import IdentifyOrgClient, { IdentifyOrgReply } from "@/services/kycVerification/providers/identifyorg/identifyOrgClient";
import { selfieDataUri } from "./kycFixtures";

const values = { bvn: "22212345678", first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", selfie: selfieDataUri() };
const contact = { phoneNumber: "+2348031234567" };
const ok = (data: Record<string, unknown>): IdentifyOrgReply => ({ status: 200, data });
const bvnOk = (extra: Record<string, unknown> = {}) => ok({ id: "ver_1", type: "bvn", status: "success", match: true, confidence_score: 98, data: { gender: "Female" }, ...extra });
const face = (match: boolean, similarity: number) => ok({ id: "ver_2", type: "bvn_face", status: "success", match, confidence_score: similarity, data: { similarity_score: similarity } });

describe("IdentifyOrg KYC verifier", () => {
    const postJson = jest.fn();
    const postImage = jest.fn();
    const verifier = new IdentifyOrgKycVerifier({ postJson, postImage } as unknown as IdentifyOrgClient);
    const run = (level = "bvn_selfie", overrides: Record<string, string> = {}) => verifier.verify({ level, values: { ...values, ...overrides }, contact });

    beforeEach(() => {
        jest.resetAllMocks();
        for (const method of ["info", "warn", "error"] as const) jest.spyOn(console, method).mockImplementation(() => undefined);
    });

    it("matches the BVN with names, date of birth and the verified phone (local format), then the selfie with the BVN photo", async () => {
        postJson.mockResolvedValue(bvnOk());
        postImage.mockResolvedValue(face(true, 86));
        await expect(run()).resolves.toEqual({
            outcome: "verified",
            reason: null,
            reference: "ver_1",
            evidence: { bvnFound: true, name: true, dateOfBirth: true, phone: true, gender: true, confidence: 98, face: true, faceSimilarity: 86 },
        });
        expect(postJson).toHaveBeenCalledWith("/v1/verify/bvn", { bvn: values.bvn, first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", phone_number: "08031234567" });
        expect(postImage).toHaveBeenCalledWith("/v1/verify/bvn-face", "selfie", expect.objectContaining({ mimeType: "image/jpeg" }), { bvn: values.bvn });
    });

    it("skips the face check at the bvn level", async () => {
        postJson.mockResolvedValue(bvnOk());
        await expect(run("bvn")).resolves.toMatchObject({ outcome: "verified" });
        expect(postImage).not.toHaveBeenCalled();
    });

    it.each([
        [["first_name"], /name doesn't match/],
        [["date_of_birth"], /date of birth/],
        [["phone_number"], /phone number isn't the one linked/],
        [[], /details don't match/],
    ])("rejects a BVN mismatch on %j with a reason the user can act on — and never pays for the face check", async (fields, reason) => {
        postJson.mockResolvedValue(bvnOk({ match: false, mismatched_fields: fields }));
        await expect(run()).resolves.toMatchObject({ outcome: "rejected", reason: expect.stringMatching(reason) });
        expect(postImage).not.toHaveBeenCalled();
    });

    it("rejects a gender that doesn't match the BVN record, and a BVN that doesn't exist", async () => {
        postJson.mockResolvedValueOnce(bvnOk({ data: { gender: "Male" } }));
        await expect(run()).resolves.toMatchObject({ outcome: "rejected", reason: expect.stringMatching(/gender/) });
        postJson.mockResolvedValueOnce(ok({ status: "not_found", failure_reason: "x" }));
        await expect(run()).resolves.toMatchObject({ outcome: "rejected", reason: expect.stringMatching(/couldn't find this BVN/) });
    });

    it("rejects a selfie that doesn't match the BVN photo", async () => {
        postJson.mockResolvedValue(bvnOk());
        postImage.mockResolvedValue(face(false, 41));
        await expect(run()).resolves.toMatchObject({ outcome: "rejected", reason: expect.stringMatching(/doesn't match your BVN photo/), evidence: { face: false, faceSimilarity: 41 } });
    });

    it.each([
        ["a network failure", { status: null, code: "ECONNRESET" }],
        ["a timeout", { status: null, code: "ECONNABORTED" }],
        ["an outage", { status: 502, data: {} }],
        ["rate limiting", { status: 429, data: {} }],
        ["our key refused", { status: 401, data: { error: { message: "Invalid key" } } }],
        ["an empty wallet", { status: 402, data: { error: { message: "Insufficient balance" } } }],
        ["a request it didn't accept", { status: 400, data: { error: { message: "phone_number is required" } } }],
    ])("never rejects the user for %s — the check is unavailable", async (_why, reply) => {
        postJson.mockResolvedValue(reply);
        await expect(run()).resolves.toMatchObject({ outcome: "unavailable" });
    });

    it("is unavailable (not rejected) when the face check can't run after the BVN passed", async () => {
        postJson.mockResolvedValue(bvnOk());
        postImage.mockResolvedValue({ status: 503, data: {} });
        await expect(run()).resolves.toMatchObject({ outcome: "unavailable" });
    });
});
