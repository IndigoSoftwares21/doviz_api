import { createHmac } from "crypto";
import axios from "axios";
import KUCOIN from "./constants";

export interface KucoinHttpRequest {
    method: "GET" | "POST";
    url: string;
    data?: string;
    headers: Record<string, string>;
}

/** The transport. Real: axios. Tests: a fake. */
export interface KucoinHttp {
    request(request: KucoinHttpRequest): Promise<{ status: number; data: unknown }>;
}

export const axiosHttp = ({ baseUrl }: { baseUrl: string }): KucoinHttp => {
    const instance = axios.create({ baseURL: baseUrl, timeout: KUCOIN.TIMEOUT_MS, validateStatus: () => true, transformRequest: [(data) => data] });
    return { request: (request) => instance.request(request) };
};

export const hmac = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("base64");

/** Query string exactly as signed: not URL-encoded (KuCoin signs the raw path). */
export const toQuery = (query?: Record<string, string | undefined>) => {
    const pairs = Object.entries(query ?? {}).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "");
    return pairs.length ? `?${pairs.map(([key, value]) => `${key}=${value}`).join("&")}` : "";
};
