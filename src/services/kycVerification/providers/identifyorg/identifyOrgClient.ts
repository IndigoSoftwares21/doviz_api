import axios from "axios";

const TIMEOUT_MS = 30_000;

export type IdentifyOrgReply = { status: number; data: Record<string, unknown> } | { status: null; code: string };

/**
 * IdentifyOrg's HTTP API (X-IdentifyOrg-Key). Never throws for an HTTP
 * status — the caller decides — and returns { status: null } on a network
 * failure or timeout. Never logs a body: requests and replies hold personal data.
 */
class IdentifyOrgClient {
    constructor(
        private readonly apiKey: string,
        private readonly baseUrl: string = process.env.IDENTIFYORG_BASE_URL || "https://api.identifyorg.com",
    ) {}

    postJson(path: string, body: Record<string, unknown>) {
        return this.send(path, body, { "Content-Type": "application/json" });
    }

    /** One image as multipart/form-data under `field`, plus any query parameters. */
    postImage(path: string, field: string, image: { bytes: Buffer; mimeType: string }, params: Record<string, string> = {}) {
        const form = new FormData();
        form.append(field, new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }), image.mimeType === "image/png" ? "selfie.png" : "selfie.jpg");
        return this.send(path, form, {}, params);
    }

    private async send(path: string, body: unknown, headers: Record<string, string>, params: Record<string, string> = {}): Promise<IdentifyOrgReply> {
        try {
            const response = await axios.post(`${this.baseUrl.replace(/\/+$/, "")}${path}`, body, {
                headers: { "X-IdentifyOrg-Key": this.apiKey, ...headers },
                params,
                timeout: TIMEOUT_MS,
                validateStatus: () => true,
            });
            return { status: response.status, data: (response.data ?? {}) as Record<string, unknown> };
        } catch (error) {
            return { status: null, code: axios.isAxiosError(error) ? (error.code ?? "unknown") : "unknown" };
        }
    }
}

export default IdentifyOrgClient;
