import escapeHtml from "@/docs/utils/escapeHtml";

const renderDocsLoginPage = ({ nonce, error }: { nonce: string; error?: string }) => {
    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Ziks API Reference</title>
    <style nonce="${escapeHtml({ value: nonce })}">
        :root {
            --bg: #f6f6f4;
            --card: #ffffff;
            --border: #e6e6e3;
            --text: #16161a;
            --muted: #6b6b73;
            --field: #ffffff;
            --field-border: #d6d6d2;
            --focus: rgba(22, 22, 26, 0.12);
            --accent: #16161a;
            --accent-text: #ffffff;
            --accent-hover: #2c2c33;
            --error-bg: #fdf1f0;
            --error-border: #f3cfcb;
            --error-text: #9b2c22;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0e0e10;
                --card: #17171a;
                --border: #26262b;
                --text: #f2f2f3;
                --muted: #9a9aa3;
                --field: #0e0e10;
                --field-border: #32323a;
                --focus: rgba(242, 242, 243, 0.14);
                --accent: #f2f2f3;
                --accent-text: #0e0e10;
                --accent-hover: #d9d9dc;
                --error-bg: #2a1513;
                --error-border: #4a221e;
                --error-text: #f0a59c;
            }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            background: var(--bg);
            color: var(--text);
            font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        main { width: 100%; max-width: 380px; }
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 32px 28px 28px;
        }
        .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
        .mark {
            width: 30px; height: 30px; border-radius: 8px;
            display: grid; place-items: center;
            background: var(--accent); color: var(--accent-text);
            font-weight: 700; font-size: 14px; letter-spacing: -0.02em;
        }
        .brand span { font-weight: 600; letter-spacing: -0.01em; }
        h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 4px; }
        .subtitle { color: var(--muted); margin-bottom: 24px; }
        .error {
            background: var(--error-bg); border: 1px solid var(--error-border); color: var(--error-text);
            border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 18px;
        }
        label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
        input[type="password"] {
            width: 100%; padding: 10px 12px; border-radius: 8px;
            border: 1px solid var(--field-border); background: var(--field); color: var(--text);
            font: inherit; outline: none; transition: border-color .15s, box-shadow .15s;
        }
        input[type="password"]:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus); }
        button {
            width: 100%; margin-top: 16px; padding: 10px 16px; border: 0; border-radius: 8px;
            background: var(--accent); color: var(--accent-text);
            font: inherit; font-weight: 500; cursor: pointer; transition: background .15s;
        }
        button:hover { background: var(--accent-hover); }
        button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .footnote { margin-top: 16px; text-align: center; font-size: 12px; color: var(--muted); }
        .hidden { display: none; }
    </style>
</head>
<body>
    <main>
        <div class="card">
            <div class="brand"><div class="mark" aria-hidden="true">Z</div><span>Ziks</span></div>
            <h1>API reference</h1>
            <p class="subtitle">Enter the docs password to continue.</p>
            ${error ? `<div class="error" role="alert">${escapeHtml({ value: error })}</div>` : ""}
            <form method="post" action="/docs/login">
                <input class="hidden" type="text" name="username" value="doviz-docs" autocomplete="username" tabindex="-1" aria-hidden="true" />
                <label for="password">Password</label>
                <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
                <button type="submit">Continue</button>
            </form>
        </div>
        <p class="footnote">Internal &middot; access is logged</p>
    </main>
</body>
</html>`;

    return html;
};

export default renderDocsLoginPage;
