import axios from "axios";
import monitoring from "@/utils/monitoring";
import { BILL_PROVIDER_ERROR_CODE } from "@/constants/bills";
import BillProviderError from "../../billProviderError";
import FLUTTERWAVE from "./constants";
import getFlutterwaveConfig, { FlutterwaveConfig } from "./getFlutterwaveConfig";

/**
 * Flutterwave refuses setup problems with a plain 400; these messages are ours
 * to fix, not the customer's: credentials, IP whitelist, or a biller/item code
 * Flutterwave no longer recognises (our catalog is stale — re-sync).
 */
const CONFIGURATION_MESSAGE = /whitelist|authorization required|invalid (secret )?key|unauthori[sz]ed|unknown biller|invalid biller/i;

export interface FlutterwaveHttpRequest {
    method: "GET" | "POST";
    url: string;
    params?: Record<string, unknown>;
    data?: unknown;
    headers: Record<string, string>;
}

/** The transport. Real: axios. Tests: a fake. */
export interface FlutterwaveHttp {
    request(request: FlutterwaveHttpRequest): Promise<{ status: number; data: unknown }>;
}

const axiosHttp = ({ baseUrl }: { baseUrl: string }): FlutterwaveHttp => {
    const instance = axios.create({ baseURL: baseUrl, timeout: FLUTTERWAVE.TIMEOUT_MS, validateStatus: () => true });
    return { request: (request) => instance.request(request) };
};

/**
 * Authenticated HTTP to Flutterwave v3. Unwraps `{ status, message, data }`
 * and turns every failure into a neutral BillProviderError:
 *   network / timeout / 429 / 5xx → unavailable (outcome unknown)
 *   404                           → not_found
 *   401 / 403, or a key / IP-whitelist refusal → configuration (our setup)
 *   other 4xx, or status "error"  → rejected (Flutterwave refused it)
 * Logs method, path and status only — never headers, bodies or the key.
 */
class FlutterwaveClient {
    private readonly config: FlutterwaveConfig;
    private readonly http: FlutterwaveHttp;

    constructor({ config, http }: { config?: FlutterwaveConfig; http?: FlutterwaveHttp } = {}) {
        this.config = config ?? getFlutterwaveConfig();
        this.http = http ?? axiosHttp({ baseUrl: this.config.baseUrl });
    }

    get environment() {
        return this.config.environment;
    }

    async request<T>({ method, path, params, body }: { method: FlutterwaveHttpRequest["method"]; path: string; params?: Record<string, unknown>; body?: unknown }): Promise<T> {
        const headers = { Authorization: `Bearer ${this.config.secretKey}`, "Content-Type": "application/json" };

        let response: { status: number; data: unknown };
        try {
            response = await this.http.request({ method, url: path, params, data: body, headers });
        } catch {
            monitoring.warn(`Flutterwave ${method} ${path} → network error`);
            throw new BillProviderError({ code: BILL_PROVIDER_ERROR_CODE.UNAVAILABLE, status: null, providerMessage: null });
        }

        monitoring.info(`Flutterwave ${method} ${path} → ${response.status}`);
        const envelope = (response.data ?? {}) as { status?: string; message?: string | null; data?: unknown };
        const message = typeof envelope.message === "string" ? envelope.message : null;

        if (response.status >= 200 && response.status < 300) {
            if (envelope.status === "success") return envelope.data as T;
            if (envelope.status === "error") {
                const code = CONFIGURATION_MESSAGE.test(message ?? "") ? BILL_PROVIDER_ERROR_CODE.CONFIGURATION : BILL_PROVIDER_ERROR_CODE.REJECTED;
                throw new BillProviderError({ code, status: response.status, providerMessage: message });
            }
            throw new BillProviderError({ code: BILL_PROVIDER_ERROR_CODE.INVALID_RESPONSE, status: response.status, providerMessage: message });
        }

        const code =
            response.status === 404
                ? BILL_PROVIDER_ERROR_CODE.NOT_FOUND
                : response.status === 429 || response.status >= 500
                  ? BILL_PROVIDER_ERROR_CODE.UNAVAILABLE
                  : response.status === 401 || response.status === 403 || CONFIGURATION_MESSAGE.test(message ?? "")
                    ? BILL_PROVIDER_ERROR_CODE.CONFIGURATION
                    : BILL_PROVIDER_ERROR_CODE.REJECTED;
        throw new BillProviderError({ code, status: response.status, providerMessage: message });
    }
}

export default FlutterwaveClient;
