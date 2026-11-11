import request from "supertest";
import app from "../../src/app";
import DOCS from "@/constants/docs";
import { configureDocs, sessionCookie } from "./docsHelpers";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));

describe("API docs session", () => {
    beforeEach(configureDocs);

    it("serves Scalar with a pinned, integrity-checked script for a valid session", async () => {
        const response = await request(app.express).get("/docs").set("Cookie", sessionCookie());
        const nonce = /'nonce-([^']+)'/.exec(response.headers["content-security-policy"])?.[1];

        expect(response.status).toBe(200);
        expect(response.text).toContain(DOCS.SCALAR_SCRIPT_URL);
        expect(response.text).toContain(`integrity="${DOCS.SCALAR_SCRIPT_INTEGRITY}"`);
        expect(DOCS.SCALAR_SCRIPT_URL).toMatch(/@\d+\.\d+\.\d+\//);
        // Every script tag carries this request's nonce.
        const scriptTags = response.text.match(/<script[^>]*>/g) ?? [];
        expect(scriptTags.length).toBe(3);
        scriptTags.forEach((tag) => expect(tag).toContain(`nonce="${nonce}"`));
        expect(response.headers["content-security-policy"]).toContain("connect-src 'self'");
    });

    it("serves the spec for a valid session", async () => {
        const response = await request(app.express)
            .get("/docs/openapi.json")
            .set("Cookie", sessionCookie());

        expect(response.status).toBe(200);
        expect(response.body.info.title).toBe("Ziks API");
    });

    it.each([
        ["expired", () => sessionCookie({ expiresAt: Date.now() - 1000 })],
        ["tampered", () => sessionCookie().replace(/.$/, (c) => (c === "a" ? "b" : "a"))],
        ["garbage", () => `${DOCS.COOKIE_NAME}=%E0%A4%A`],
        ["signed before a password change", () => sessionCookie({ password: "old-password-123" })],
    ])("rejects a %s session cookie", async (_label, cookie) => {
        const response = await request(app.express).get("/docs").set("Cookie", cookie());

        expect(response.status).toBe(303);
        expect(response.headers.location).toBe("/docs/login");
    });

    it("logs out by clearing the cookie", async () => {
        const response = await request(app.express).get("/docs/logout");

        expect(response.status).toBe(303);
        expect(response.headers["set-cookie"]?.[0]).toMatch(/doviz_docs_session=;.*Expires=Thu, 01 Jan 1970/);
    });
});
