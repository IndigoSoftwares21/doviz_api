import postUserKycSchema from "@/controllers/userKyc/post/schema/postUserKycSchema";
import fetchVerifiedKycFields from "@/actions/kycFields/fetchVerifiedKycFields";
import { selfieDataUri } from "./kycFixtures";
import fetchActiveKycLevel from "@/actions/appSettings/fetchActiveKycLevel";

const level = (value: string) => jest.mocked(fetchActiveKycLevel).mockResolvedValue({ data: value });

jest.mock("@/actions/kycFields/fetchVerifiedKycFields");
jest.mock("@/actions/appSettings/fetchActiveKycLevel");

const onFile = (...keys: string[]) =>
    jest.mocked(fetchVerifiedKycFields).mockResolvedValue({ data: new Map(keys.map((key) => [key, { id: key, fieldKey: key }])) } as never);

const details = {
    bvn: "222 1234 5678",
    first_name: " Ada ",
    middle_name: "",
    last_name: "Okafor",
    date_of_birth: "1994-03-18",
    gender: "female",
    address: "12  Allen Avenue,\n Ikeja",
    city: "Lagos",
    selfie: selfieDataUri(),
};
const parse = (input: Record<string, unknown>) => postUserKycSchema.safeParseAsync({ userId: "user-1", pin: "1234", ...input });
const problems = async (input: Record<string, unknown>) => {
    const parsed = await parse(input);
    return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("KYC submission validation (built from the field registry)", () => {
    beforeEach(() => {
        onFile();
        level("bvn_selfie");
    });

    it("accepts, normalises, and drops blank optional fields", async () => {
        await expect(postUserKycSchema.parseAsync({ userId: "user-1", pin: "1234", details })).resolves.toEqual({
            level: "bvn_selfie",
            pin: "1234",
            values: { bvn: "22212345678", first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", address: "12 Allen Avenue, Ikeja", city: "Lagos", selfie: details.selfie },
        });
    });

    it("lets fields already on file be left out, and reuses them", async () => {
        onFile("bvn", "date_of_birth", "gender", "address", "city", "selfie");
        level("bvn");
        const parsed = await parse({ level: "bvn", details: { first_name: "Ada", last_name: "Okafor" } });
        expect(parsed.success && parsed.data.values).toEqual({ first_name: "Ada", last_name: "Okafor" });
    });

    it("always asks for a new selfie, even when one is on file", async () => {
        onFile("bvn", "first_name", "last_name", "date_of_birth", "gender", "address", "city", "selfie");
        expect(await problems({ details: {} })).toEqual(["details.selfie: Take a selfie"]);
    });

    it("asks for every required field that isn't on file", async () => {
        const found = await problems({ details: {} });
        for (const key of ["bvn", "first_name", "last_name", "date_of_birth", "gender", "address", "city", "selfie"]) {
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
        ["selfie", "data:image/jpeg;base64,AAAA"],
        ["selfie", `data:image/jpeg;base64,${Buffer.alloc(3000, 1).toString("base64")}`],
        ["selfie", "https://example.com/me.jpg"],
        ["selfie", `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(1_600_000)]).toString("base64")}`],
    ])("refuses a bad %s", async (key, value) => {
        const found = await problems({ details: { ...details, [key]: value } });
        expect(found.some((problem) => problem.startsWith(`details.${key}:`))).toBe(true);
    });

    it("refuses fields the form doesn't ask for, and unknown levels", async () => {
        expect(await problems({ details: { ...details, mothers_maiden_name: "x" } })).toContain("details.mothers_maiden_name: This isn't part of the form");
        // The server's setting decides the level: a form from before a switch is refused.
        expect(await problems({ details, level: "bvn" })).toEqual(["level: The verification steps changed. Go back and open verification again."]);
    });

    it("never echoes what was typed in its messages", async () => {
        const found = await problems({ details: { ...details, bvn: "99999999", date_of_birth: "1999-13-45", gender: "zzqq-gender" } });
        expect(found.join(" ")).not.toMatch(/99999999|1999-13-45|zzqq-gender/);
    });
});
