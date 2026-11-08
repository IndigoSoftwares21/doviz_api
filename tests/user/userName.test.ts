import personNameSchema from "@/utils/validation/personNameSchema";
import optionalPersonNameSchema from "@/utils/validation/optionalPersonNameSchema";
import modifyUserName from "@/actions/userName/modifyUserName";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import selectUserNameForUpdate from "@/actions/userName/modifyUserName/queries/selectUserNameForUpdate";
import updateUserName from "@/actions/userName/modifyUserName/queries/updateUserName";
import createAuditLog from "@/actions/auditLog/createAuditLog";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/pinVerification/createPinVerification");
jest.mock("@/actions/userName/modifyUserName/queries/selectUserNameForUpdate");
jest.mock("@/actions/userName/modifyUserName/queries/updateUserName");
jest.mock("@/actions/auditLog/createAuditLog");

const firstName = personNameSchema({ label: "First name" });

describe("personNameSchema", () => {
    it.each([
        ["Adéṣọlá", "Adéṣọlá"],
        ["O'Neil", "O'Neil"],
        ["Okafor-Eze", "Okafor-Eze"],
        ["Chukwuemeka", "Chukwuemeka"],
        ["  Mary   Jane ", "Mary Jane"],
        ["D’Souza", "D’Souza"],
        ["李小龙", "李小龙"],
    ])("accepts %j", async (input, expected) => {
        await expect(firstName.parseAsync(input)).resolves.toBe(expected);
    });

    it("normalises decomposed accents to one stored form", async () => {
        const decomposed = "Adéṣọlá";
        await expect(firstName.parseAsync(decomposed)).resolves.toBe(decomposed.normalize("NFC"));
    });

    it.each(["", "   ", "Ada2", "Ada 😀", "-Ada", "<script>", "A".repeat(51)])("rejects %j", async (input) => {
        await expect(firstName.parseAsync(input)).rejects.toThrow();
    });

    it("treats a blank middle name as none", async () => {
        const middleName = optionalPersonNameSchema({ label: "Middle name" });
        await expect(middleName.parseAsync("  ")).resolves.toBeUndefined();
        await expect(middleName.parseAsync(null)).resolves.toBeUndefined();
    });
});

describe("modifyUserName", () => {
    const base = { userId: "user-1", firstName: "Ada", middleName: null, lastName: "Lovelace", ipAddress: "1.2.3.4", userAgent: "jest" };

    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectUserNameForUpdate).mockResolvedValue({ firstName: "Ada", middleName: null, lastName: "Byron" });
        jest.mocked(updateUserName).mockResolvedValue({ firstName: "Ada", middleName: null, lastName: "Lovelace", nameUpdatedAt: new Date() });
    });

    it("saves without a PIN during onboarding", async () => {
        const { data, verification } = await modifyUserName(base);

        expect(createPinVerification).not.toHaveBeenCalled();
        expect(verification).toBeNull();
        expect(data?.lastName).toBe("Lovelace");
    });

    it("doesn't change the name when the PIN is wrong", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "invalid", remainingAttempts: 3 } });

        const { data } = await modifyUserName({ ...base, pin: "9999" });

        expect(data).toBeNull();
        expect(updateUserName).not.toHaveBeenCalled();
    });

    it("keeps the previous name in the audit log", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } });

        await modifyUserName({ ...base, pin: "4827" });

        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "user.name.updated",
                metadata: {
                    previous: { firstName: "Ada", middleName: null, lastName: "Byron" },
                    current: { firstName: "Ada", middleName: null, lastName: "Lovelace" },
                },
            }),
        );
        expect(JSON.stringify(jest.mocked(createAuditLog).mock.calls)).not.toContain("4827");
    });
});
