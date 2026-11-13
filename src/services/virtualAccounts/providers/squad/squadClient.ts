import axios from "axios";

const TIMEOUT_MS = 30_000;

export type SquadReply = { status: number; data: Record<string, unknown> } | { status: null; code: string };

/** Squad's HTTP API (Bearer secret key). Never throws for a status; never logs a body. */
class SquadClient {
    constructor(
        private readonly secretKey: string,
        readonly baseUrl: string,
    ) {}

    get(path: string) {
        return this.send("GET", path);
    }

    post(path: string, body: Record<string, unknown>) {
        return this.send("POST", path, body);
    }

    private async send(method: "GET" | "POST", path: string, body?: unknown): Promise<SquadReply> {
        try {
            const response = await axios.request({
                method,
                url: `${this.baseUrl.replace(/\/+$/, "")}${path}`,
                data: body,
                headers: { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json" },
                timeout: TIMEOUT_MS,
                validateStatus: () => true,
            });
            return { status: response.status, data: (response.data ?? {}) as Record<string, unknown> };
        } catch (error) {
            return { status: null, code: axios.isAxiosError(error) ? (error.code ?? "unknown") : "unknown" };
        }
    }
}

export default SquadClient;
