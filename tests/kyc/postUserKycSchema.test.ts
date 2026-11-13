import postUserKycSchema from "@/controllers/userKyc/post/schema/postUserKycSchema";

const valid = {
    bvn: "222 1234 5678",
    firstName: " Ada ",
    middleName: "",
    lastName: "Okafor",
    dateOfBirth: "1994-03-18",
    gender: "female",
    address: "12  Allen Avenue,\n Ikeja",
    pin: "1234",
};

const problems = async (input: Record<string, unknown>) => {
    const parsed = await postUserKycSchema.safeParseAsync(input);
    return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("KYC submission validation", () => {
    it("accepts and normalises valid details", async () => {
        await expect(postUserKycSchema.parseAsync(valid)).resolves.toEqual({
            ...valid,
            bvn: "22212345678",
            firstName: "Ada",
            middleName: null,
            address: "12 Allen Avenue, Ikeja",
        });
    });

    it.each([
        ["bvn", "2221234567"],
        ["bvn", "2221234567a"],
        ["dateOfBirth", "18/03/1994"],
        ["dateOfBirth", "2001-02-30"],
        ["dateOfBirth", new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)],
        ["dateOfBirth", `${new Date().getUTCFullYear() - 10}-01-01`],
        ["dateOfBirth", "1890-01-01"],
        ["gender", "other"],
        ["address", "abc"],
        ["address", "12 <script> Road"],
        ["firstName", "Ada2"],
    ])("refuses a bad %s", async (field, value) => {
        const found = await problems({ ...valid, [field]: value });
        expect(found.some((problem) => problem.startsWith(`${field}:`))).toBe(true);
    });

    it("never echoes what was typed in its messages", async () => {
        const found = await problems({ ...valid, bvn: "99999999", dateOfBirth: "1999-13-45", gender: "zzqq-gender" });
        expect(found.join(" ")).not.toMatch(/99999999|1999-13-45|zzqq-gender/);
    });
});
