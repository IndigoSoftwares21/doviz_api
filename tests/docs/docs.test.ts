import request from "supertest";
import app from "../../src/app";
import openApiSpec from "@/docs/openapi";
import appRoutes from "@/routes/app.routes";
import authRoutes from "@/routes/auth.routes";
import userRoutes from "@/routes/user.routes";
import signDocsSession from "@/utils/docs/signDocsSession";
import DOCS from "@/constants/docs";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));

const PASSWORD = "correct-horse-battery";
const SECRET = "docs-secret-docs-secret-docs-secret-0001";

const sessionCookie = ({
    expiresAt = Date.now() + 60_000,
    password = PASSWORD,
}: { expiresAt?: number; password?: string } = {}) =>
    `${DOCS.COOKIE_NAME}=${signDocsSession({ secret: SECRET, password, expiresAt })}`;

const login = (password: string) =>
    request(app.express).post("/docs/login").type("form").send({ password });

describe("API docs", () => {
    beforeEach(() => {
        process.env.DOCS_PASSWORD = PASSWORD;
        process.env.DOCS_SESSION_SECRET = SECRET;
    });

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
        expect(response.body.info.title).toBe("Doviz API");
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

    // Keep last: shares the in-memory limiter with the wrong-password test.
    it("rate-limits repeated wrong passwords", async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
            statuses.push((await login("wrong-password")).status);
        }

        expect(statuses).toContain(429);
    });
});

describe("OpenAPI spec coverage", () => {
    const documented = Object.entries(openApiSpec.paths).flatMap(([path, operations]) =>
        Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`),
    );

    type Layer = { route?: { path: string; methods: Record<string, boolean> } };
    const routesOf = (router: { stack: Layer[] }, prefix: string) =>
        router.stack
            .filter((layer) => layer.route)
            .flatMap((layer) =>
                Object.keys(layer.route!.methods).map(
                    (method) =>
                        `${method.toUpperCase()} ${prefix}${layer.route!.path.replace(/:(\w+)/g, "{$1}")}`,
                ),
            );

    const registered = [
        ...routesOf(appRoutes as unknown as { stack: Layer[] }, "").filter(
            (route) => !route.endsWith("/demo"), // template reference endpoints
        ),
        ...routesOf(authRoutes as unknown as { stack: Layer[] }, "/auth"),
        ...routesOf(userRoutes as unknown as { stack: Layer[] }, "/user").map((route) => route.replace(/\/$/, "")),
    ];

    it("documents every registered route, and nothing that doesn't exist", () => {
        expect(documented.sort()).toEqual(registered.sort());
    });
});
