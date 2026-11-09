import ProviderError from "@/services/crypto/providers/breet/providerError";
import { FakeBreetHttp, TEST_CONFIG, fail, fakeClient, ok } from "./breetFakes";

const call = (http: FakeBreetHttp) => fakeClient(http).request({ method: "GET", path: "/trades/assets" });

describe("BreetClient", () => {
    it("authenticates every request with app id, secret and environment", async () => {
        const http = new FakeBreetHttp().reply("GET /trades/assets", ok([]));
        await call(http);

        expect(http.requests[0].headers).toMatchObject({
            "x-app-id": TEST_CONFIG.appId,
            "x-app-secret": TEST_CONFIG.appSecret,
            "X-Breet-Env": "sandbox",
        });
    });

    it("unwraps the success envelope", async () => {
        const http = new FakeBreetHttp().reply("GET /trades/assets", ok([{ id: "a1" }]));
        await expect(call(http)).resolves.toEqual([{ id: "a1" }]);
    });

    it.each([
        [401, false, "http_error"],
        [403, false, "http_error"],
        [404, false, "not_found"],
        [422, false, "http_error"],
        [429, true, "http_error"],
        [500, true, "http_error"],
        [503, true, "http_error"],
    ])("maps HTTP %i to a ProviderError (retryable=%s)", async (status, retryable, code) => {
        const http = new FakeBreetHttp().reply("GET /trades/assets", fail(status, "nope"));
        const error = await call(http).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ProviderError);
        expect(error).toMatchObject({ status, retryable, code, providerMessage: "nope" });
    });

    it("treats a 200 with success:false as a failure", async () => {
        const http = new FakeBreetHttp().reply("GET /trades/assets", { status: 200, data: { success: false, message: "bad" } });
        await expect(call(http)).rejects.toMatchObject({ code: "http_error", providerMessage: "bad" });
    });

    it("maps a network failure to a retryable error", async () => {
        const http = new FakeBreetHttp().reply("GET /trades/assets", new Error("ECONNRESET"));
        await expect(call(http)).rejects.toMatchObject({ code: "network_error", retryable: true, status: null });
    });

    it("never logs the app secret", async () => {
        const lines: string[] = [];
        const spies = (["info", "warn", "error", "log"] as const).map((level) =>
            jest.spyOn(console, level).mockImplementation((...args: unknown[]) => void lines.push(JSON.stringify(args))),
        );
        await call(new FakeBreetHttp().reply("GET /trades/assets", fail(500, "boom"))).catch(() => undefined);
        spies.forEach((spy) => spy.mockRestore());

        expect(lines.join("\n")).not.toContain(TEST_CONFIG.appSecret);
    });
});
