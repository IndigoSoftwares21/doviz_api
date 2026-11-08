import express from "express";
import request from "supertest";
import requireAuth from "@/middlewares/requireAuth";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import jwt from "jsonwebtoken";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");

const app = express();
app.get("/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
});

describe("requireAuth", () => {
    beforeEach(() => jest.resetAllMocks());

    it("rejects a request with no token", async () => {
        const response = await request(app).get("/me");
        expect(response.status).toBe(401);
    });

    it("rejects a token signed with another secret", async () => {
        const forged = jwt.sign({ sid: "s" }, "x".repeat(40), {
            subject: "u",
            issuer: "doviz-api",
            audience: "doviz-app",
        });
        const response = await request(app).get("/me").set("Authorization", `Bearer ${forged}`);
        expect(response.status).toBe(401);
        expect(selectActiveSession).not.toHaveBeenCalled();
    });

    it("rejects an unsigned (alg: none) token", async () => {
        const unsigned = jwt.sign({ sid: "s", sub: "u", iss: "doviz-api", aud: "doviz-app" }, "", {
            algorithm: "none",
        });
        const response = await request(app).get("/me").set("Authorization", `Bearer ${unsigned}`);
        expect(response.status).toBe(401);
    });

    it("rejects a valid token whose session is revoked or expired", async () => {
        jest.mocked(selectActiveSession).mockResolvedValue(undefined);
        const token = signAccessToken({ userId: "user-1", sessionId: "session-1" });

        const response = await request(app).get("/me").set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(selectActiveSession).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", sessionId: "session-1" }),
        );
    });

    it.each(["suspended", "closed"])("returns 403 for a %s account", async (accountStatus) => {
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus });
        const token = signAccessToken({ userId: "user-1", sessionId: "session-1" });

        const response = await request(app).get("/me").set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/not active/);
    });

    it("attaches the user for a valid token with a live session", async () => {
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "active" });
        const token = signAccessToken({ userId: "user-1", sessionId: "session-1" });

        const response = await request(app).get("/me").set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.user).toEqual({ id: "user-1", sessionId: "session-1", deviceId: "device-abc-123" });
    });
});
