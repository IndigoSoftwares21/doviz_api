import DOCS from "@/constants/docs";
import escapeHtml from "@/docs/utils/escapeHtml";

// Dev convenience (as on Wema): a successful POST /auth/login stores the
// access token in sessionStorage (cleared when the tab closes) and attaches
// it to later "Try it" requests that don't already set Authorization.
const TOKEN_HELPER = `
(function () {
    var KEY = "doviz-docs:access-token";
    var originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        var url = typeof input === "string" ? input : (input && input.url) || String(input);
        init = init || {};
        if (url.indexOf("/api/v1/") !== -1) {
            var token = sessionStorage.getItem(KEY);
            var headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
            if (token && !headers.has("Authorization")) {
                headers.set("Authorization", "Bearer " + token);
                init.headers = headers;
            }
        }
        var response = await originalFetch(input, init);
        if (url.indexOf("/api/v1/app/auth/login") !== -1 && response.ok) {
            try {
                var body = await response.clone().json();
                if (body && body.data && body.data.accessToken) {
                    sessionStorage.setItem(KEY, body.data.accessToken);
                }
            } catch (e) {}
        }
        return response;
    };
})();`;

const renderDocsPage = ({ nonce }: { nonce: string }) => {
    const nonceAttr = escapeHtml({ value: nonce });
    const configuration = JSON.stringify({
        url: "/docs/openapi.json",
        theme: "default",
        layout: "modern",
        hideClientButton: false,
        persistAuth: false,
        authentication: { preferredSecurityScheme: "BearerAuth" },
    });

    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta property="csp-nonce" content="${nonceAttr}" />
    <title>Ziks API Reference</title>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonceAttr}">${TOKEN_HELPER}</script>
    <script nonce="${nonceAttr}" src="${DOCS.SCALAR_SCRIPT_URL}" integrity="${DOCS.SCALAR_SCRIPT_INTEGRITY}" crossorigin="anonymous"></script>
    <script nonce="${nonceAttr}">Scalar.createApiReference("#app", ${configuration});</script>
</body>
</html>`;

    return html;
};

export default renderDocsPage;
