import request from "supertest";
import app from "../../src/app";
import signDocsSession from "@/utils/docs/signDocsSession";
import DOCS from "@/constants/docs";

export const PASSWORD = "correct-horse-battery";
const SECRET = "docs-secret-docs-secret-docs-secret-0001";

/** A valid (or deliberately expired / stale-password) docs session cookie. */
export const sessionCookie = ({
    expiresAt = Date.now() + 60_000,
    password = PASSWORD,
}: { expiresAt?: number; password?: string } = {}) =>
    `${DOCS.COOKIE_NAME}=${signDocsSession({ secret: SECRET, password, expiresAt })}`;

export const login = (password: string) => request(app.express).post("/docs/login").type("form").send({ password });

export const configureDocs = () => {
    process.env.DOCS_PASSWORD = PASSWORD;
    process.env.DOCS_SESSION_SECRET = SECRET;
};
