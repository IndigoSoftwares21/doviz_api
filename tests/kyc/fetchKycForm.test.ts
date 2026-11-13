import fetchKycForm from "@/actions/userKyc/fetchKycForm";
import fetchCurrentKycFields from "@/actions/kycFields/fetchCurrentKycFields";
import selectProfileNames from "@/actions/userKyc/fetchKycForm/queries/selectProfileNames";
import { KYC_FIELDS } from "@/constants/kycFields";

jest.mock("@/actions/kycFields/fetchCurrentKycFields");
jest.mock("@/actions/userKyc/fetchKycForm/queries/selectProfileNames");

describe("KYC form (server-driven)", () => {
    beforeEach(() => {
        jest.mocked(selectProfileNames).mockResolvedValue({ firstName: "Ada", middleName: null, lastName: "Okafor" });
    });

    it("describes every field from the registry, pre-filling names from the profile", async () => {
        jest.mocked(fetchCurrentKycFields).mockResolvedValue({ data: new Map() } as never);
        const { data } = await fetchKycForm({ userId: "user-1" });

        expect(data.level).toBe("bvn_selfie");
        expect(data.fields.map((field) => field.key)).toEqual(["bvn", "first_name", "last_name", "date_of_birth", "gender", "address", "selfie", "middle_name"]);
        expect(data.fields.find((field) => field.key === "selfie")).toMatchObject({ type: "selfie", required: true, onFile: false, maxBytes: 1_500_000 });
        expect(data.fields[0]).toMatchObject({ type: "digits", label: "BVN", hint: KYC_FIELDS.bvn.hint, length: 11, required: true, onFile: false, display: null, value: null });
        expect(data.fields.find((field) => field.key === "first_name")).toMatchObject({ value: "Ada", required: true });
        expect(data.fields.find((field) => field.key === "middle_name")).toMatchObject({ required: false, value: null });
        expect(data.fields.find((field) => field.key === "gender")?.options).toEqual(KYC_FIELDS.gender.options);
        // Internal flags never reach the app.
        for (const field of data.fields) {
            for (const internal of ["identifier", "displayHint", "prefill", "fresh", "storedAsFile"]) expect(field).not.toHaveProperty(internal);
        }
    });

    it("marks saved fields on file with only a masked hint, and never pre-fills over them", async () => {
        jest.mocked(fetchCurrentKycFields).mockResolvedValue({
            data: new Map([
                ["bvn", { id: "f1", fieldKey: "bvn", displayHint: "5678" }],
                ["first_name", { id: "f2", fieldKey: "first_name", displayHint: null }],
                ["selfie", { id: "f3", fieldKey: "selfie", displayHint: null }],
            ]),
        } as never);
        const { data } = await fetchKycForm({ userId: "user-1" });

        expect(data.fields.find((field) => field.key === "bvn")).toMatchObject({ onFile: true, display: "•••••••5678", value: null });
        expect(data.fields.find((field) => field.key === "first_name")).toMatchObject({ onFile: true, display: null, value: null });
        // A selfie is never reused.
        expect(data.fields.find((field) => field.key === "selfie")).toMatchObject({ onFile: false });
    });
});
