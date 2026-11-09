import request from "supertest";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectProviderBank from "@/schemaHelpers/selectProviderBank";
import selectUserLegalName from "@/schemaHelpers/selectUserLegalName";
import selectActiveBankAccountByNumber from "@/schemaHelpers/selectActiveBankAccountByNumber";
import createBankResolution from "@/actions/bankResolution/createBankResolution";
import createBankAccount from "@/actions/bankAccount/createBankAccount";
import { useFakeProvider } from "./fakeProvider";
import { BANK_ID, authHeader, createTestApp } from "./testApp";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/schemaHelpers/selectProviderBank");
jest.mock("@/schemaHelpers/selectUserLegalName");
jest.mock("@/schemaHelpers/selectActiveBankAccountByNumber");
jest.mock("@/actions/bankResolution/createBankResolution");
jest.mock("@/actions/bankAccount/createBankAccount");

const app = createTestApp();
const post = (path: string, body: object) => request(app).post(`/api/v1/app${path}`).set("Authorization", authHeader()).send(body);
const lookup = { bankId: BANK_ID, accountNumber: "0123456789" };
const verified = { status: "verified" as const };

describe("bank routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        useFakeProvider();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
        jest.mocked(selectUserLegalName).mockResolvedValue({ firstName: "Adaeze", lastName: "Okafor", hasPin: true });
        jest.mocked(selectProviderBank).mockResolvedValue({ id: BANK_ID, name: "GTBank", code: "058", providerBankId: "39" });
    });

    it("resolves an account name and says whether it's the user's", async () => {
        jest.mocked(createBankResolution).mockResolvedValue({ data: { accountName: "OKAFOR ADAEZE", nameMatches: true }, failure: null });
        const response = await post("/banks/resolve", lookup);
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ accountName: "OKAFOR ADAEZE", nameMatches: true });
    });

    it("rejects a non-10-digit account number", async () => {
        const response = await post("/banks/resolve", { ...lookup, accountNumber: "12345" });
        expect(response.status).toBe(400);
        expect(createBankResolution).not.toHaveBeenCalled();
    });

    it("reports a failed lookup clearly", async () => {
        jest.mocked(createBankResolution).mockResolvedValue({ data: null, failure: "resolve_failed" });
        const response = await post("/banks/resolve", lookup);
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/couldn't verify/);
    });

    it("blocks adding an account that isn't in the user's name", async () => {
        jest.mocked(createBankAccount).mockResolvedValue({ data: null, failure: "name_mismatch", verification: verified });
        const response = await post("/user/bank-accounts", { ...lookup, pin: "4827" });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe("This account isn't in your name");
    });

    it("shows PIN failures with attempts left", async () => {
        jest.mocked(createBankAccount).mockResolvedValue({ data: null, failure: "pin", verification: { status: "invalid", remainingAttempts: 3 } });
        const response = await post("/user/bank-accounts", { ...lookup, pin: "9999" });
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/3 attempts remaining/);
    });

    it("refuses an account already added", async () => {
        jest.mocked(selectActiveBankAccountByNumber).mockResolvedValue({ id: "ba-1" });
        const response = await post("/user/bank-accounts", { ...lookup, pin: "4827" });
        expect(response.status).toBe(400);
        expect(createBankAccount).not.toHaveBeenCalled();
    });

    it("adds a matching account and returns it masked", async () => {
        const saved = { id: "ba-1", bankId: BANK_ID, bankName: "GTBank", accountNumber: "******6789", accountName: "OKAFOR ADAEZE", isPrimary: true, verifiedAt: new Date() };
        jest.mocked(createBankAccount).mockResolvedValue({ data: saved, failure: null, verification: verified });
        const response = await post("/user/bank-accounts", { ...lookup, pin: "4827" });
        expect(response.status).toBe(201);
        expect(response.body.data.accountNumber).toBe("******6789");
    });
});
