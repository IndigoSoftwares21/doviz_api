import request from "supertest";
import app from "../src/app";

describe("GET /api/v1/app/health", () => {
    it("returns a 200 status with an ok payload", async () => {
        const response = await request(app.express).get("/api/v1/app/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });
});
