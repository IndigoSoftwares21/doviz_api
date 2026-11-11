import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import authRoutes from "@/routes/auth.routes";
import signAccessToken from "@/utils/auth/signAccessToken";
import verifyAccessToken from "@/utils/auth/verifyAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import AUTH from "@/constants/auth";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

const app = express();
app.use(express.json());
app.use("/api/v1/app/auth", authRoutes);
const extend = (token?: string) => {
    const call = request(app).post("/api/v1/app/auth/session/extend");
    return token ? call.set("Authorization", `Bearer ${token}`) : call;
};

describe("POST /auth/session/extend", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
    });

    it("gives a live session a fresh token for the same user and session, no PIN", async () => {
        const response = await extend(signAccessToken({ userId: "user-1", sessionId: "session-1" }));

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const { accessToken, accessTokenExpiresAt } = response.body.data;
        expect(verifyAccessToken({ token: accessToken })).toMatchObject({ userId: "user-1", sessionId: "session-1" });
        const ttl = new Date(accessTokenExpiresAt).getTime() - Date.now();
        expect(ttl).toBeGreaterThan((AUTH.ACCESS_TOKEN_TTL_SECONDS - 5) * 1000);
    });

    it("refuses an expired token — an idle user must unlock with their PIN", async () => {
        const expired = jwt.sign({ sid: "session-1" }, process.env.JWT_ACCESS_SECRET!, {
            algorithm: "HS256", subject: "user-1", issuer: AUTH.JWT_ISSUER, audience: AUTH.JWT_AUDIENCE, expiresIn: -10,
        });
        expect((await extend(expired)).status).toBe(401);
        expect((await extend()).status).toBe(401);
    });

    it("refuses a revoked session", async () => {
        jest.mocked(selectActiveSession).mockResolvedValue(undefined);
        expect((await extend(signAccessToken({ userId: "user-1", sessionId: "session-1" }))).status).toBe(401);
    });
});
