import FlutterwaveClient, { FlutterwaveHttp, FlutterwaveHttpRequest } from "@/services/bills/providers/flutterwave/flutterwaveClient";
import FlutterwaveBillProvider from "@/services/bills/providers/flutterwave/flutterwaveBillProvider";

export const TEST_CONFIG = {
    baseUrl: "https://flutterwave.test/v3",
    secretKey: "FLWSECK_TEST-secret-0123456789",
    environment: "sandbox" as const,
};

type Reply = { status: number; data: unknown } | Error;

/** Records requests and answers from a queue keyed by "METHOD path". */
export class FakeFlutterwaveHttp implements FlutterwaveHttp {
    readonly requests: FlutterwaveHttpRequest[] = [];
    private readonly replies = new Map<string, Reply[]>();

    reply(key: string, ...replies: Reply[]) {
        this.replies.set(key, [...(this.replies.get(key) ?? []), ...replies]);
        return this;
    }

    request(request: FlutterwaveHttpRequest) {
        this.requests.push(request);
        const queue = this.replies.get(`${request.method} ${request.url}`) ?? [];
        const next = queue.length > 1 ? queue.shift() : queue[0];
        if (!next) return Promise.reject(new Error(`No fake reply for ${request.method} ${request.url}`));
        if (next instanceof Error) return Promise.reject(next);
        return Promise.resolve(next);
    }
}

export const ok = (data: unknown, message = "ok") => ({ status: 200, data: { status: "success", message, data } });
export const fail = (status: number, message: string | null) => ({ status, data: { status: "error", message, data: null } });

export const fakeProvider = (http: FakeFlutterwaveHttp) =>
    new FlutterwaveBillProvider({ client: new FlutterwaveClient({ config: TEST_CONFIG, http }) });
