import express from "express";
import request from "supertest";
import nairaDepositRoutes from "@/routes/nairaDeposit.routes";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import createNairaDeposit from "@/actions/nairaDeposit/createNairaDeposit";
import fetchNairaDeposit from "@/actions/nairaDeposit/fetchNairaDeposit";
import fetchNairaDeposits from "@/actions/nairaDeposits/fetchNairaDeposits";
import fetchActiveNairaDeposit from "@/actions/nairaDeposit/fetchActiveNairaDeposit";
import createNairaDepositCancellation from "@/actions/nairaDepositCancellation/createNairaDepositCancellation";
import ACTION_FAILURE from "@/constants/actionFailure";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/nairaDeposit/createNairaDeposit");
jest.mock("@/actions/nairaDeposit/fetchNairaDeposit");
jest.mock("@/actions/nairaDeposits/fetchNairaDeposits");
jest.mock("@/actions/nairaDeposit/fetchActiveNairaDeposit");
jest.mock("@/actions/nairaDepositCancellation/createNairaDepositCancellation");

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

const DEPOSIT_ID = "3b241101-e2bb-4255-8caf-4136c566a962";
const KEY = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const view = {
    id: DEPOSIT_ID, status: "pending", currency: "NGN", amount: "50000.00", fee: "375.00", feeBearer: "user",
    amountToTransfer: "50375.00", amountCredited: null,
    bankAccount: { accountName: "Doviz Checkout", accountNumber: "9876543210", bankName: "Wema Bank" },
    expiresAt: "2026-11-10T13:00:00.000Z", failureReason: null, createdAt: "2026-11-10T12:30:00.000Z", completedAt: null,
};

const app = express();
app.use(express.json());
app.use("/api/v1/app/naira-deposits", nairaDepositRoutes);

const auth = () => `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`;
const post = (body: object) => request(app).post("/api/v1/app/naira-deposits").set("Authorization", auth()).send(body);

describe("naira deposit routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
    });

    it("requires auth", async () => {
        const response = await request(app).post("/api/v1/app/naira-deposits").send({ amount: "50000", idempotencyKey: KEY });
        expect(response.status).toBe(401);
    });

    it("starts a deposit and returns the account to pay into", async () => {
        jest.mocked(createNairaDeposit).mockResolvedValue({ data: view as never, failure: null, isNew: true });
        const response = await post({ amount: "50000", idempotencyKey: KEY });
        expect(response.status).toBe(201);
        expect(createNairaDeposit).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", amount: "50000.00", idempotencyKey: KEY }));
        expect(response.body.data).toMatchObject({ amountToTransfer: "50375.00", bankAccount: { accountNumber: "9876543210" } });
        expect(JSON.stringify(response.body)).not.toMatch(/korapay/i);
    });

    it("answers 200 for a repeated idempotency key", async () => {
        jest.mocked(createNairaDeposit).mockResolvedValue({ data: view as never, failure: null, isNew: false });
        expect((await post({ amount: "50000.00", idempotencyKey: KEY })).status).toBe(200);
    });

    it.each([
        [{ amount: "99.99", idempotencyKey: KEY }, /Minimum/],
        [{ amount: "5000000.01", idempotencyKey: KEY }, /Maximum/],
        [{ amount: "100.001", idempotencyKey: KEY }, /2 decimals/],
        [{ amount: 50000, idempotencyKey: KEY }, /string/],
        [{ amount: "50000" }, /Idempotency key/],
    ])("rejects %j", async (body, message) => {
        const response = await post(body);
        expect(response.status).toBe(400);
        expect(JSON.stringify(response.body)).toMatch(message);
        expect(createNairaDeposit).not.toHaveBeenCalled();
    });

    it("answers 503 when no provider can issue an account", async () => {
        jest.mocked(createNairaDeposit).mockResolvedValue({ data: null, failure: ACTION_FAILURE.PROVIDER_UNAVAILABLE, isNew: false });
        expect((await post({ amount: "50000", idempotencyKey: KEY })).status).toBe(503);
    });

    it("fetches one deposit, 404 for someone else's", async () => {
        jest.mocked(fetchNairaDeposit).mockResolvedValueOnce({ data: view as never }).mockResolvedValueOnce({ data: null });
        const ok = await request(app).get(`/api/v1/app/naira-deposits/${DEPOSIT_ID}`).set("Authorization", auth());
        expect(ok.status).toBe(200);
        expect(fetchNairaDeposit).toHaveBeenCalledWith({ userId: "user-1", nairaDepositId: DEPOSIT_ID });
        expect((await request(app).get(`/api/v1/app/naira-deposits/${DEPOSIT_ID}`).set("Authorization", auth())).status).toBe(404);
        expect((await request(app).get("/api/v1/app/naira-deposits/not-a-uuid").set("Authorization", auth())).status).toBe(400);
    });

    it("returns the deposit in progress, or null — and isn't mistaken for an id", async () => {
        jest.mocked(fetchActiveNairaDeposit).mockResolvedValueOnce({ data: view as never }).mockResolvedValueOnce({ data: null });
        const active = await request(app).get("/api/v1/app/naira-deposits/active").set("Authorization", auth());
        expect(active.status).toBe(200);
        expect(active.body.data).toMatchObject({ id: DEPOSIT_ID });
        expect(fetchActiveNairaDeposit).toHaveBeenCalledWith({ userId: "user-1" });
        expect(fetchNairaDeposit).not.toHaveBeenCalled();
        const none = await request(app).get("/api/v1/app/naira-deposits/active").set("Authorization", auth());
        expect(none.status).toBe(200);
        expect(none.body.data).toBeNull();
    });

    it("lists deposits with limit/offset", async () => {
        jest.mocked(fetchNairaDeposits).mockResolvedValue({ data: { items: [view as never], limit: 5, offset: 10, hasMore: false } });
        const response = await request(app).get("/api/v1/app/naira-deposits?limit=5&offset=10").set("Authorization", auth());
        expect(response.status).toBe(200);
        expect(fetchNairaDeposits).toHaveBeenCalledWith({ userId: "user-1", limit: 5, offset: 10 });
    });

    it("cancels the user's own top-up, 404 for someone else's, 400 for a bad id", async () => {
        const cancel = (id: string) => request(app).post(`/api/v1/app/naira-deposits/${id}/cancel`).set("Authorization", auth());
        jest.mocked(createNairaDepositCancellation).mockResolvedValue({ data: { ...view, status: "expired" } } as never);
        const response = await cancel(DEPOSIT_ID);
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe("expired");
        expect(createNairaDepositCancellation).toHaveBeenCalledWith({ userId: "user-1", nairaDepositId: DEPOSIT_ID });

        jest.mocked(createNairaDepositCancellation).mockResolvedValue({ data: null });
        expect((await cancel(DEPOSIT_ID)).status).toBe(404);
        expect((await cancel("not-a-uuid")).status).toBe(400);
    });
});
