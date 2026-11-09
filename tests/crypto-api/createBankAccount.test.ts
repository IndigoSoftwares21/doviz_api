import createBankAccount from "@/actions/bankAccount/createBankAccount";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import selectResolutionBank from "@/actions/bankResolution/createBankResolution/queries/selectResolutionBank";
import selectResolutionUser from "@/actions/bankResolution/createBankResolution/queries/selectResolutionUser";
import selectPrimaryBankAccount from "@/actions/bankAccount/createBankAccount/queries/selectPrimaryBankAccount";
import insertBankAccount from "@/actions/bankAccount/createBankAccount/queries/insertBankAccount";
import selectBankName from "@/actions/bankAccount/createBankAccount/queries/selectBankName";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import { useFakeProvider } from "./fakeProvider";

jest.mock("@/database", () => ({ withTransaction: (callback: (trx: unknown) => unknown) => callback({}) }));
jest.mock("@/actions/pinVerification/createPinVerification");
jest.mock("@/actions/bankResolution/createBankResolution/queries/selectResolutionBank");
jest.mock("@/actions/bankResolution/createBankResolution/queries/selectResolutionUser");
jest.mock("@/actions/bankAccount/createBankAccount/queries/selectPrimaryBankAccount");
jest.mock("@/actions/bankAccount/createBankAccount/queries/insertBankAccount");
jest.mock("@/actions/bankAccount/createBankAccount/queries/selectBankName");
jest.mock("@/actions/auditLog/createAuditLog");

const args = { userId: "user-1", bankId: "bank-1", accountNumber: "0123456789", pin: "4827", ipAddress: null, userAgent: null };

describe("createBankAccount", () => {
    let provider: ReturnType<typeof useFakeProvider>;
    beforeEach(() => {
        jest.resetAllMocks();
        provider = useFakeProvider();
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } });
        jest.mocked(selectResolutionBank).mockResolvedValue({ providerBankId: "39" });
        jest.mocked(selectResolutionUser).mockResolvedValue({ firstName: "Adaeze", lastName: "Okafor" });
        jest.mocked(selectBankName).mockResolvedValue({ name: "GTBank" });
        jest.mocked(insertBankAccount).mockImplementation(({ accountNumber, accountName, isPrimary, verifiedAt }) =>
            Promise.resolve({ id: "ba-1", accountNumber, accountName, isPrimary, verifiedAt }),
        );
    });

    it("checks the PIN before touching the bank lookup", async () => {
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "invalid", remainingAttempts: 2 } });
        const result = await createBankAccount(args);
        expect(result.failure).toBe("pin");
        expect(provider.resolveBankAccount).not.toHaveBeenCalled();
    });

    it("refuses an account in someone else's name", async () => {
        provider.resolveBankAccount.mockResolvedValue({ accountName: "NWOSU CHIDI" });
        const result = await createBankAccount(args);
        expect(result.failure).toBe("name_mismatch");
        expect(insertBankAccount).not.toHaveBeenCalled();
    });

    it("reports a failed lookup without saving", async () => {
        provider.resolveBankAccount.mockRejectedValue(new Error("bank down"));
        const result = await createBankAccount(args);
        expect(result.failure).toBe("resolve_failed");
        expect(insertBankAccount).not.toHaveBeenCalled();
    });

    it("saves the bank's own name, primary when it's the first account, and masks the number", async () => {
        provider.resolveBankAccount.mockResolvedValue({ accountName: "OKAFOR ADAEZE CHIOMA" });
        jest.mocked(selectPrimaryBankAccount).mockResolvedValue(undefined);
        const { data } = await createBankAccount(args);
        expect(insertBankAccount).toHaveBeenCalledWith(expect.objectContaining({ accountName: "OKAFOR ADAEZE CHIOMA", isPrimary: true }));
        expect(data?.accountNumber).toBe("******6789");
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "payout.bank_account.added" }));
    });

    it("adds later accounts as non-primary", async () => {
        provider.resolveBankAccount.mockResolvedValue({ accountName: "ADAEZE OKAFOR" });
        jest.mocked(selectPrimaryBankAccount).mockResolvedValue({ id: "ba-0" });
        await createBankAccount(args);
        expect(insertBankAccount).toHaveBeenCalledWith(expect.objectContaining({ isPrimary: false }));
    });
});
