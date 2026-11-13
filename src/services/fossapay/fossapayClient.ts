import axios from "axios";

const TIMEOUT_MS = 30_000;

export type FossapayReply = { status: number; data: Record<string, unknown> } | { status: null; code: string };

/**
 * Fossapay's HTTP API (x-api-key, no scheme) — shared by account numbers and payouts. Production only — Fossapay has
 * no sandbox, so every call is live. Never throws for a status; never logs a body.
 */
class FossapayClient {
    constructor(
        private readonly apiKey: string,
        private readonly baseUrl: string = process.env.FOSSAPAY_BASE_URL || "https://api-production.fossapay.com/api/v1",
    ) {}

    get(path: string) {
        return this.send("GET", path);
    }

    /** `headers` e.g. { "X-Idempotency-Key": … } for payouts. */
    post(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
        return this.send("POST", path, body, headers);
    }

    private async send(method: "GET" | "POST", path: string, body?: Record<string, unknown>, headers: Record<string, string> = {}): Promise<FossapayReply> {
        try {
            const response = await axios.request({
                method,
                url: `${this.baseUrl.replace(/\/+$/, "")}${path}`,
                data: body,
                headers: { "x-api-key": this.apiKey, "Content-Type": "application/json", ...headers },
                timeout: TIMEOUT_MS,
                validateStatus: () => true,
            });
            return { status: response.status, data: (response.data ?? {}) as Record<string, unknown> };
        } catch (error) {
            return { status: null, code: axios.isAxiosError(error) ? (error.code ?? "unknown") : "unknown" };
        }
    }
}

export default FossapayClient;
