import postUserKycSchema from "@/controllers/userKyc/post/schema/postUserKycSchema";
import fetchCurrentKycFields from "@/actions/kycFields/fetchCurrentKycFields";

jest.mock("@/actions/kycFields/fetchCurrentKycFields");

const onFile = (...keys: string[]) =>
    jest.mocked(fetchCurrentKycFields).mockResolvedValue({ data: new Map(keys.map((key) => [key, { id: key, fieldKey: key }])) } as never);

const details = {
    bvn: "222 1234 5678",
    first_name: " Ada ",
    middle_name: "",
    last_name: "Okafor",
    date_of_birth: "1994-03-18",
    gender: "female",
    address: "12  Allen Avenue,\n Ikeja",
};
const parse = (input: Record<string, unknown>) => postUserKycSchema.safeParseAsync({ userId: "user-1", pin: "1234", ...input });
const problems = async (input: Record<string, unknown>) => {
    const parsed = await parse(input);
    return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("KYC submission validation (built from the field registry)", () => {
    beforeEach(() => onFile());

    it("accepts, normalises, and drops blank optional fields", async () => {
        await expect(postUserKycSchema.parseAsync({ userId: "user-1", pin: "1234", details })).resolves.toEqual({
            level: "bvn",
            pin: "1234",
            values: { bvn: "22212345678", first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", address: "12 Allen Avenue, Ikeja" },
        });
    });

    it("lets fields already on file be left out, and reuses them", async () => {
        onFile("bvn", "date_of_birth", "gender", "address");
        const parsed = await parse({ details: { first_name: "Ada", last_name: "Okafor" } });
        expect(parsed.success && parsed.data.values).toEqual({ first_name: "Ada", last_name: "Okafor" });
    });

    it("asks for every required field that isn't on file", async () => {
        const found = await problems({ details: {} });
        for (const key of ["bvn", "first_name", "last_name", "date_of_birth", "gender", "address"]) {
            expect(found.some((problem) => problem.startsWith(`details.${key}:`))).toBe(true);
        }
        expect(found.some((problem) => problem.startsWith("details.middle_name:"))).toBe(false);
    });

    it.each([
        ["bvn", "2221234567"],
        ["bvn", "2221234567a"],
        ["date_of_birth", "18/03/1994"],
        ["date_of_birth", "2001-02-30"],
        ["date_of_birth", new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)],
        ["date_of_birth", `${new Date().getUTCFullYear() - 10}-01-01`],
        ["date_of_birth", "1890-01-01"],
        ["gender", "other"],
        ["address", "abc"],
        ["address", "12 <script> Road"],
        ["first_name", "Ada2"],
        ["first_name", 42],
    ])("refuses a bad %s", async (key, value) => {
        const found = await problems({ details: { ...details, [key]: value } });
        expect(found.some((problem) => problem.startsWith(`details.${key}:`))).toBe(true);
    });

    it("refuses fields the form doesn't ask for, and unknown levels", async () => {
        expect(await problems({ details: { ...details, mothers_maiden_name: "x" } })).toContain("details.mothers_maiden_name: This isn't part of the form");
        expect((await problems({ details, level: "gold" })).some((problem) => problem.startsWith("level:"))).toBe(true);
    });

    it("never echoes what was typed in its messages", async () => {
        const found = await problems({ details: { ...details, bvn: "99999999", date_of_birth: "1999-13-45", gender: "zzqq-gender" } });
        expect(found.join(" ")).not.toMatch(/99999999|1999-13-45|zzqq-gender/);
    });
});
