import axios from "axios";
import monitoring from "@/utils/monitoring";
import BREET from "./constants";
import getBreetConfig, { BreetConfig } from "./getBreetConfig";
import ProviderError from "./providerError";

export interface BreetHttpRequest {
    method: "GET" | "POST" | "PUT" | "DELETE";
    url: string;
    params?: Record<string, unknown>;
    data?: unknown;
    headers: Record<string, string>;
}

/** The transport. Real: axios. Tests: a fake. */
export interface BreetHttp {
    request(request: BreetHttpRequest): Promise<{ status: number; data: unknown }>;
}

const axiosHttp = ({ baseUrl }: { baseUrl: string }): BreetHttp => {
    const instance = axios.create({ baseURL: baseUrl, timeout: BREET.TIMEOUT_MS, validateStatus: () => true });
    return { request: (request) => instance.request(request) };
};

/**
 * Authenticated HTTP to Breet. Unwraps `{ success, data }` and turns every
 * failure into a ProviderError. Logs method, path and status only — never
 * headers, bodies or credentials.
 */
class BreetClient {
    private readonly config: BreetConfig;
    private readonly http: BreetHttp;

    constructor({ config, http }: { config?: BreetConfig; http?: BreetHttp } = {}) {
        this.config = config ?? getBreetConfig();
        this.http = http ?? axiosHttp({ baseUrl: this.config.baseUrl });
    }

    get environment() {
        return this.config.environment;
    }

    async request<T>({ method, path, params, body }: { method: BreetHttpRequest["method"]; path: string; params?: Record<string, unknown>; body?: unknown }): Promise<T> {
        const headers = {
            "x-app-id": this.config.appId,
            "x-app-secret": this.config.appSecret,
            "X-Breet-Env": this.config.environment,
            "Content-Type": "application/json",
        };

        let response: { status: number; data: unknown };
        try {
            response = await this.http.request({ method, url: path, params, data: body, headers });
        } catch {
            monitoring.warn(`Breet ${method} ${path} → network error`);
            throw new ProviderError({ code: "network_error", status: null, retryable: true, providerMessage: null });
        }

        const envelope = (response.data ?? {}) as { success?: boolean; message?: string; data?: unknown };
        monitoring.info(`Breet ${method} ${path} → ${response.status}`);

        if (response.status >= 200 && response.status < 300 && envelope.success !== false) {
            return envelope.data as T;
        }

        const message = typeof envelope.message === "string" ? envelope.message : null;
        throw new ProviderError({
            code: response.status === 404 ? "not_found" : "http_error",
            status: response.status,
            retryable: response.status === 429 || response.status >= 500,
            providerMessage: message,
        });
    }
}

export default BreetClient;
