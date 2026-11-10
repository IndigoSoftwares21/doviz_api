import KorapayClient, { KorapayHttp, KorapayHttpRequest } from "@/services/collections/providers/korapay/korapayClient";
import KorapayCollectionProvider from "@/services/collections/providers/korapay/korapayCollectionProvider";
import { KorapayConfig } from "@/services/collections/providers/korapay/getKorapayConfig";

export const TEST_CONFIG: KorapayConfig = {
    baseUrl: "https://korapay.test/merchant/api/v1",
    secretKey: "sk_test_secret_0123456789",
    publicKey: "pk_test_public-key-0123",
    environment: "sandbox",
    webhookUrl: "https://api.doviz.test/api/v1/webhooks/korapay",
    fallbackCustomerEmail: "deposits@doviz.test",
};

type Reply = { status: number; data: unknown } | Error;

/** Records requests and answers from a queue keyed by "METHOD path". */
export class FakeKorapayHttp implements KorapayHttp {
    readonly requests: KorapayHttpRequest[] = [];
    private readonly replies = new Map<string, Reply[]>();

    reply(key: string, ...replies: Reply[]) {
        this.replies.set(key, [...(this.replies.get(key) ?? []), ...replies]);
        return this;
    }

    request(request: KorapayHttpRequest) {
        this.requests.push(request);
        const queue = this.replies.get(`${request.method} ${request.url}`) ?? [];
        const next = queue.length > 1 ? queue.shift() : queue[0];
        if (!next) return Promise.reject(new Error(`No fake reply for ${request.method} ${request.url}`));
        if (next instanceof Error) return Promise.reject(next);
        return Promise.resolve(next);
    }
}

export const ok = (data: unknown, message = "ok") => ({ status: 200, data: { status: true, message, data } });
export const fail = (status: number, message: string | null) => ({ status, data: { status: false, message, data: null } });

export const fakeKorapay = (http: FakeKorapayHttp, config: Partial<KorapayConfig> = {}) =>
    new KorapayCollectionProvider({ client: new KorapayClient({ config: { ...TEST_CONFIG, ...config }, http }) });
