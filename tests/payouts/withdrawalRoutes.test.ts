import express from "express";
import request from "supertest";
import walletRoutes from "@/routes/wallet.routes";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectUserActiveBankAccount from "@/schemaHelpers/selectUserActiveBankAccount";
import fetchWithdrawalQuote from "@/actions/withdrawalQuote/fetchWithdrawalQuote";
import createWithdrawal from "@/actions/withdrawal/createWithdrawal";
import fetchWithdrawal from "@/actions/withdrawal/fetchWithdrawal";
import ACTION_FAILURE from "@/constants/actionFailure";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/schemaHelpers/selectUserActiveBankAccount");
jest.mock("@/actions/withdrawalQuote/fetchWithdrawalQuote");
jest.mock("@/actions/withdrawal/createWithdrawal");
jest.mock("@/actions/withdrawal/fetchWithdrawal");

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

const ACCOUNT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const KEY = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const app = express();
app.use(express.json());
app.use("/api/v1/app/wallet", walletRoutes);
const auth = () => `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`;
const get = (path: string) => request(app).get(`/api/v1/app/wallet${path}`).set("Authorization", auth());
const send = (body: object) =>
    request(app).post("/api/v1/app/wallet/withdrawals").set("Authorization", auth())
        .send({ bankAccountId: ACCOUNT_ID, amount: "5000.00", expectedTotal: "5015.31", idempotencyKey: KEY, pin: "4827", ...body });
const verified = { status: "verified" as const };
const quote = {
    provider: { name: "fakepayout" }, providerBankId: "058", currency: "NGN", amount: "5000.00", fee: "15.31", feeIsExact: false, totalHeld: "5015.31",
    account: { id: ACCOUNT_ID, payoutBankId: "b-1", accountNumber: "0123456789", accountName: "OKAFOR ADA", bankName: "GTBank" },
};

describe("withdrawal routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
        jest.mocked(selectUserActiveBankAccount).mockResolvedValue({ id: ACCOUNT_ID });
    });

    it("prices a withdrawal, masking the account", async () => {
        jest.mocked(fetchWithdrawalQuote).mockResolvedValue({ data: quote, failure: null } as never);
        const response = await get(`/withdrawals/quote?bankAccountId=${ACCOUNT_ID}&amount=5000.00`);
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({
            bankAccount: { id: ACCOUNT_ID, bankName: "GTBank", accountNumber: "******6789", accountName: "OKAFOR ADA" },
            currency: "NGN", amount: "5000.00", fee: "15.31", feeIsExact: false, totalHeld: "5015.31",
        });
    });

    it("only allows the user's own accounts", async () => {
        jest.mocked(selectUserActiveBankAccount).mockResolvedValue(undefined);
        const response = await get(`/withdrawals/quote?bankAccountId=${ACCOUNT_ID}&amount=5000.00`);
        expect(response.status).toBe(400);
        expect(response.body.validationErrors).toEqual([{ path: ["bankAccountId"], message: "Choose one of your bank accounts" }]);
    });

    it.each([["50.00", "Minimum is ₦100.00"], ["6000000.00", "Maximum is ₦5,000,000.00"], ["12.345", "Amount must be a positive amount with at most 2 decimals"]])(
        "checks the amount %s",
        async (amount, message) => {
            const response = await get(`/withdrawals/quote?bankAccountId=${ACCOUNT_ID}&amount=${amount}`);
            expect(response.status).toBe(400);
            expect(response.body.validationErrors[0]).toEqual({ path: ["amount"], message });
        },
    );

    it("explains the payout partner's own limits", async () => {
        jest.mocked(fetchWithdrawalQuote).mockResolvedValue({ data: null, failure: ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, limits: { minAmount: "1000.00", maxAmount: "10000000.00" } } as never);
        const response = await get(`/withdrawals/quote?bankAccountId=${ACCOUNT_ID}&amount=500.00`);
        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Minimum is ₦1,000.00");
    });

    it("says when the active provider can't pay to this bank", async () => {
        jest.mocked(fetchWithdrawalQuote).mockResolvedValue({ data: null, failure: ACTION_FAILURE.BANK_UNSUPPORTED } as never);
        const response = await get(`/withdrawals/quote?bankAccountId=${ACCOUNT_ID}&amount=5000.00`);
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/unavailable right now/);
    });

    it("sends a withdrawal (201) and returns the original for a reused key (200)", async () => {
        const view = { id: "w-1", status: "pending" };
        jest.mocked(createWithdrawal).mockResolvedValue({ data: view, failure: null, verification: verified, isNew: true, quote: null } as never);
        const created = await send({});
        expect(created.status).toBe(201);
        expect(createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", bankAccountId: ACCOUNT_ID, amount: "5000.00", expectedTotal: "5015.31", idempotencyKey: KEY }));

        jest.mocked(createWithdrawal).mockResolvedValue({ data: view, failure: null, verification: verified, isNew: false, quote: null } as never);
        expect((await send({})).status).toBe(200);
    });

    it.each([
        [ACTION_FAILURE.QUOTE_CHANGED, 409, /fee changed/],
        [ACTION_FAILURE.INSUFFICIENT_BALANCE, 402, /enough balance/],
        [ACTION_FAILURE.PROVIDER_UNAVAILABLE, 503, /temporarily unavailable/],
        [ACTION_FAILURE.BANK_UNSUPPORTED, 400, /unavailable right now/],
    ])("reports %s as %i", async (failure, status, message) => {
        jest.mocked(createWithdrawal).mockResolvedValue({ data: null, failure, verification: verified, isNew: false, quote: null } as never);
        const response = await send({});
        expect(response.status).toBe(status);
        expect(response.body.message).toMatch(message);
    });

    it("reports a wrong PIN with attempts left", async () => {
        jest.mocked(createWithdrawal).mockResolvedValue({ data: null, failure: ACTION_FAILURE.PIN, verification: { status: "invalid", remainingAttempts: 2 }, isNew: false, quote: null } as never);
        const response = await send({});
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/2 attempts remaining/);
    });

    it("requires a confirmed total and a UUID key", async () => {
        const response = await send({ expectedTotal: undefined, idempotencyKey: "abc" });
        expect(response.status).toBe(400);
        expect(response.body.validationErrors.map((error: { path: string[] }) => error.path[0]).sort()).toEqual(["expectedTotal", "idempotencyKey"]);
        expect(createWithdrawal).not.toHaveBeenCalled();
    });

    it("404s a withdrawal that isn't the user's", async () => {
        jest.mocked(fetchWithdrawal).mockResolvedValue({ data: null });
        expect((await get("/withdrawals/0b6c3a3e-1f2d-4c5b-8a9e-2d4f6a8b0c1d")).status).toBe(404);
    });
});
