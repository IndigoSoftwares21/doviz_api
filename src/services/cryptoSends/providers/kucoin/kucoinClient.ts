import monitoring from "@/utils/monitoring";
import KUCOIN from "./constants";
import getKucoinConfig, { KucoinConfig } from "./getKucoinConfig";
import { KucoinEnvelope } from "./kucoinTypes";
import toCryptoSendProviderError from "./toCryptoSendProviderError";
import { axiosHttp, hmac, KucoinHttp, KucoinHttpRequest, toQuery } from "./kucoinHttp";

export type { KucoinHttp, KucoinHttpRequest };

/**
 * Signed HTTP to KuCoin. Unwraps `{ code: "200000", data }` and turns every
 * failure into a neutral CryptoSendProviderError (toCryptoSendProviderError).
 * Logs method, path and status only — never headers, bodies or keys.
 */
class KucoinClient {
    readonly config: KucoinConfig;
    private readonly http: KucoinHttp;
    private readonly now: () => number;

    constructor({ config, http, now }: { config?: KucoinConfig; http?: KucoinHttp; now?: () => number } = {}) {
        this.config = config ?? getKucoinConfig();
        this.http = http ?? axiosHttp({ baseUrl: this.config.baseUrl });
        this.now = now ?? Date.now;
    }

    /** Headers for a private endpoint. Exposed for tests. */
    signHeaders({ method, path, body }: { method: string; path: string; body: string }) {
        const timestamp = String(this.now());
        const { apiKey, apiSecret, apiPassphrase, keyVersion } = this.config;
        return {
            "KC-API-KEY": apiKey,
            "KC-API-SIGN": hmac(apiSecret, `${timestamp}${method}${path}${body}`),
            "KC-API-TIMESTAMP": timestamp,
            "KC-API-PASSPHRASE": keyVersion === "1" ? apiPassphrase : hmac(apiSecret, apiPassphrase),
            "KC-API-KEY-VERSION": keyVersion,
        };
    }

    async request<T>({
        method,
        path,
        query,
        body,
        isPublic = false,
    }: {
        method: KucoinHttpRequest["method"];
        path: string;
        query?: Record<string, string | undefined>;
        body?: Record<string, unknown>;
        isPublic?: boolean;
    }): Promise<T> {
        const url = `${path}${toQuery(query)}`;
        const data = body === undefined ? "" : JSON.stringify(body);
        const headers: Record<string, string> = { "Content-Type": "application/json", ...(isPublic ? {} : this.signHeaders({ method, path: url, body: data })) };

        let response: { status: number; data: unknown };
        try {
            response = await this.http.request({ method, url, data: data || undefined, headers });
        } catch {
            monitoring.warn(`KuCoin ${method} ${path} → network error`);
            throw toCryptoSendProviderError({ httpStatus: null, code: null, message: null });
        }

        monitoring.info(`KuCoin ${method} ${path} → ${response.status}`);
        const envelope = (response.data && typeof response.data === "object" ? response.data : {}) as KucoinEnvelope<T>;
        const code = typeof envelope.code === "string" ? envelope.code : null;
        const message = typeof envelope.msg === "string" ? envelope.msg : null;

        if (response.status >= 200 && response.status < 300 && code === KUCOIN.SUCCESS_CODE) return envelope.data as T;
        if (response.status >= 200 && response.status < 300 && code === null) {
            throw toCryptoSendProviderError({ httpStatus: response.status, code: null, message: "Unrecognised KuCoin response" });
        }
        throw toCryptoSendProviderError({ httpStatus: response.status, code, message });
    }
}

export default KucoinClient;
