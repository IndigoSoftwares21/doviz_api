import request from "supertest";
import app from "../../src/app";
import DOCS from "@/constants/docs";
import { configureDocs, PASSWORD, login } from "./docsHelpers";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));

describe("API docs login", () => {
    beforeEach(configureDocs);

    describe("when not configured", () => {
        it.each([
            ["password missing", { DOCS_PASSWORD: "" }],
            ["password too short", { DOCS_PASSWORD: "short" }],
            ["secret too short", { DOCS_SESSION_SECRET: "short" }],
        ])("returns 404 (%s)", async (_label, env) => {
            Object.assign(process.env, env);

            const docs = await request(app.express).get("/docs");
            const loginPage = await request(app.express).get("/docs/login");

            expect(docs.status).toBe(404);
            expect(loginPage.status).toBe(404);
        });
    });

    it("redirects to the login page without a session", async () => {
        const response = await request(app.express).get("/docs");

        expect(response.status).toBe(303);
        expect(response.headers.location).toBe("/docs/login");
    });

    it("returns 401 JSON for the spec without a session", async () => {
        const response = await request(app.express).get("/docs/openapi.json");

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Authentication required", code: 401 });
    });

    it("serves the login page with a nonce-based CSP and noindex", async () => {
        const response = await request(app.express).get("/docs/login");
        const csp = response.headers["content-security-policy"];
        const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];

        expect(response.status).toBe(200);
        expect(nonce).toBeTruthy();
        expect(response.text).toContain(`<style nonce="${nonce}">`);
        expect(csp).toContain("frame-ancestors 'none'");
        expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
        expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("rejects a wrong password without setting a cookie", async () => {
        const response = await login("wrong-password");

        expect(response.status).toBe(401);
        expect(response.text).toContain("Incorrect password.");
        expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("signs in with the right password and sets a locked-down cookie", async () => {
        const response = await login(PASSWORD);
        const cookie = response.headers["set-cookie"]?.[0] ?? "";

        expect(response.status).toBe(303);
        expect(response.headers.location).toBe("/docs");
        expect(cookie).toContain(`${DOCS.COOKIE_NAME}=`);
        expect(cookie).toContain("Path=/docs");
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Strict");
        expect(cookie).toMatch(/Max-Age=28800/);
    });

    // Keep last: shares the in-memory limiter with the wrong-password test.
    it("rate-limits repeated wrong passwords", async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
            statuses.push((await login("wrong-password")).status);
        }

        expect(statuses).toContain(429);
    });
});
