const DOCS = {
    COOKIE_NAME: "doviz_docs_session",
    COOKIE_PATH: "/docs",
    SESSION_TTL_SECONDS: 8 * 60 * 60,
    MIN_PASSWORD_LENGTH: 12,
    MIN_SECRET_LENGTH: 32,
    // Pinned + SRI-checked: the browser refuses to run the bundle if the CDN
    // ever serves different bytes. To upgrade, bump the version and
    // recompute: curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
    SCALAR_SCRIPT_URL:
        "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0/dist/browser/standalone.js",
    SCALAR_SCRIPT_INTEGRITY:
        "sha384-oH1C0RwqcwbVXkC+r8A+4qRoyEUQdtxAzOwumkxZtQBBcsy61FOoPt7B50OVJYYQ",
} as const;

export default DOCS;
