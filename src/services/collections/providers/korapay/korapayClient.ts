import axios from "axios";
import monitoring from "@/utils/monitoring";
import { COLLECTION_PROVIDER_ERROR_CODE } from "@/constants/nairaDeposits";
import CollectionProviderError from "../../collectionProviderError";
import KORAPAY from "./constants";
import getKorapayConfig, { KorapayConfig } from "./getKorapayConfig";

const CONFIGURATION_MESSAGE = /invalid (secret )?key|unauthori[sz]ed|authentication|not enabled|inactive|compliance/i;

export interface KorapayHttpRequest {
    method: "GET" | "POST";
    url: string;
    data?: unknown;
    headers: Record<string, string>;
}

/** The transport. Real: axios. Tests: a fake. */
export interface KorapayHttp {
    request(request: KorapayHttpRequest): Promise<{ status: number; data: unknown }>;
}

const axiosHttp = ({ baseUrl }: { baseUrl: string }): KorapayHttp => {
    const instance = axios.create({ baseURL: baseUrl, timeout: KORAPAY.TIMEOUT_MS, validateStatus: () => true });
    return { request: (request) => instance.request(request) };
};

/**
 * Authenticated HTTP to Korapay. Unwraps `{ status, message, data }` and turns
 * every failure into a neutral CollectionProviderError:
 *   network / timeout / 429 / 5xx → unavailable
 *   404                           → not_found
 *   401 / 403, or a key / account refusal → configuration (our setup)
 *   other 4xx, or status false    → rejected
 * Logs method, path and status only — never headers, bodies or the key.
 */
class KorapayClient {
    readonly config: KorapayConfig;
    private readonly http: KorapayHttp;

    constructor({ config, http }: { config?: KorapayConfig; http?: KorapayHttp } = {}) {
        this.config = config ?? getKorapayConfig();
        this.http = http ?? axiosHttp({ baseUrl: this.config.baseUrl });
    }

    async request<T>({ method, path, body }: { method: KorapayHttpRequest["method"]; path: string; body?: unknown }): Promise<T> {
        const headers = { Authorization: `Bearer ${this.config.secretKey}`, "Content-Type": "application/json" };

        let response: { status: number; data: unknown };
        try {
            response = await this.http.request({ method, url: path, data: body, headers });
        } catch {
            monitoring.warn(`Korapay ${method} ${path} → network error`);
            throw new CollectionProviderError({ code: COLLECTION_PROVIDER_ERROR_CODE.UNAVAILABLE, status: null, providerMessage: null });
        }

        monitoring.info(`Korapay ${method} ${path} → ${response.status}`);
        const envelope = (response.data ?? {}) as { status?: boolean; message?: string | null; data?: unknown };
        const message = typeof envelope.message === "string" ? envelope.message : null;

        if (response.status >= 200 && response.status < 300) {
            if (envelope.status === true) return envelope.data as T;
            if (envelope.status === false) {
                const code = CONFIGURATION_MESSAGE.test(message ?? "") ? COLLECTION_PROVIDER_ERROR_CODE.CONFIGURATION : COLLECTION_PROVIDER_ERROR_CODE.REJECTED;
                throw new CollectionProviderError({ code, status: response.status, providerMessage: message });
            }
            throw new CollectionProviderError({ code: COLLECTION_PROVIDER_ERROR_CODE.INVALID_RESPONSE, status: response.status, providerMessage: message });
        }

        const code =
            response.status === 404 || /not found/i.test(message ?? "")
                ? COLLECTION_PROVIDER_ERROR_CODE.NOT_FOUND
                : response.status === 429 || response.status >= 500
                  ? COLLECTION_PROVIDER_ERROR_CODE.UNAVAILABLE
                  : response.status === 401 || response.status === 403 || CONFIGURATION_MESSAGE.test(message ?? "")
                    ? COLLECTION_PROVIDER_ERROR_CODE.CONFIGURATION
                    : COLLECTION_PROVIDER_ERROR_CODE.REJECTED;
        throw new CollectionProviderError({ code, status: response.status, providerMessage: message });
    }
}

export default KorapayClient;
