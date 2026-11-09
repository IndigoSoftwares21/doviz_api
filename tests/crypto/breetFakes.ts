import BreetClient, { BreetHttp, BreetHttpRequest } from "@/services/crypto/providers/breet/breetClient";

export const TEST_CONFIG = {
    baseUrl: "https://breet.test/v1",
    appId: "app-id-123",
    appSecret: "app-secret-456",
    environment: "sandbox" as const,
};

type Reply = { status: number; data: unknown } | Error;

/** Records requests and answers from a queue keyed by "METHOD path" (or a default). */
export class FakeBreetHttp implements BreetHttp {
    readonly requests: BreetHttpRequest[] = [];
    private readonly replies = new Map<string, Reply[]>();

    reply(key: string, ...replies: Reply[]) {
        this.replies.set(key, [...(this.replies.get(key) ?? []), ...replies]);
        return this;
    }

    request(request: BreetHttpRequest) {
        this.requests.push(request);
        const queue = this.replies.get(`${request.method} ${request.url}`) ?? [];
        const next = queue.length > 1 ? queue.shift() : queue[0];
        if (!next) return Promise.reject(new Error(`No fake reply for ${request.method} ${request.url}`));
        if (next instanceof Error) return Promise.reject(next);
        return Promise.resolve(next);
    }
}

export const ok = (data: unknown, status = 200) => ({ status, data: { success: true, message: "ok", data } });
export const fail = (status: number, message: string) => ({ status, data: { success: false, message, data: {} } });

export const fakeClient = (http: FakeBreetHttp) => new BreetClient({ config: TEST_CONFIG, http });

export const docsTransaction = {
    id: "692f91aa729255932afe9078",
    amount: 20310.45645038847,
    rate: 1000,
    txHash: "aa801188ukdjfhdbf3771dfdf86388b8b694a2ac0226748346y34kbc3",
    asset: "67063f653b4a1f6c7a60ec57",
    address: "6DKYpZfd86BUDTjPe4E3JEGwnYW99KU3NDazk7BjpN8V",
    sourceAddress: "bc1qf43tdrym26qlz8rg06f88wg35n27uhcf29zs4f",
    passAMLCheck: true,
    amountReceived: 21.379427842514175,
    cryptoReceived: "0.00025406",
    status: "completed",
    currency: "ngn",
    reason: "",
    updatedAt: "2025-12-03T01:26:04.066Z",
};
