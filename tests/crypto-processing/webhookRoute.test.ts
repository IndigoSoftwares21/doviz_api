import request from "supertest";
import app from "../../src/app";
import providerRegistry from "@/services/crypto/providerRegistry";
import createProviderWebhookEvent from "@/actions/providerWebhookEvent/createProviderWebhookEvent";
import createProviderWebhookRejection from "@/actions/providerWebhookRejection/createProviderWebhookRejection";
import processWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent";
import { makeFakeProvider } from "./fakeProvider";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/actions/providerWebhookEvent/createProviderWebhookEvent");
jest.mock("@/actions/providerWebhookRejection/createProviderWebhookRejection");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent");

const url = "/api/v1/webhooks/fakepay";
const event = { eventId: "ev-1", eventName: "trade.completed", resourceType: "deposit" as const, resourceId: "trade-1", eventTime: null };
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe("POST /webhooks/:provider", () => {
    let provider: ReturnType<typeof makeFakeProvider>;

    beforeEach(() => {
        jest.resetAllMocks();
        providerRegistry.reset();
        provider = makeFakeProvider({ parseWebhook: jest.fn().mockReturnValue(event) });
        providerRegistry.register(provider);
        jest.mocked(processWebhookEvent).mockResolvedValue({ data: { status: "processed" } });
    });

    it("404s for a provider that isn't registered", async () => {
        const response = await request(app.express).post("/api/v1/webhooks/nope").send({});
        expect(response.status).toBe(404);
        expect(createProviderWebhookEvent).not.toHaveBeenCalled();
    });

    it("rejects a request that fails verification and stores nothing", async () => {
        jest.mocked(provider.verifyWebhook).mockReturnValue(false);

        const response = await request(app.express).post(url).send({ event: "trade.completed" });

        expect(response.status).toBe(401);
        expect(createProviderWebhookEvent).not.toHaveBeenCalled();
        expect(createProviderWebhookRejection).toHaveBeenCalledWith(expect.objectContaining({ provider: "fakepay" }));
    });

    it("answers an authenticated verification ping with 200 and stores nothing", async () => {
        jest.mocked(provider.verifyWebhook).mockReturnValue(true);
        jest.mocked(provider.isWebhookPing).mockReturnValue(true);
        const response = await request(app.express).post(url).send({ event: "webhook.verification" });
        expect(response.status).toBe(200);
        expect(createProviderWebhookEvent).not.toHaveBeenCalled();
    });

    it("still 401s a ping that fails verification", async () => {
        jest.mocked(provider.verifyWebhook).mockReturnValue(false);
        jest.mocked(provider.isWebhookPing).mockReturnValue(true);
        const response = await request(app.express).post(url).send({ event: "webhook.verification" });
        expect(response.status).toBe(401);
    });

    it("400s when the body isn't a recognisable event", async () => {
        jest.mocked(provider.parseWebhook).mockReturnValue(null);
        const response = await request(app.express).post(url).send({});
        expect(response.status).toBe(400);
        expect(createProviderWebhookEvent).not.toHaveBeenCalled();
    });

    it("stores a new event, answers 200 at once, then processes it", async () => {
        jest.mocked(createProviderWebhookEvent).mockResolvedValue({ data: { id: "row-1", isNew: true } });

        const response = await request(app.express).post(url).send({ event: "trade.completed" });
        await flushAsync();

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ received: true });
        expect(processWebhookEvent).toHaveBeenCalledWith({ id: "row-1" });
    });

    it("answers 200 to a redelivery without processing it again", async () => {
        jest.mocked(createProviderWebhookEvent).mockResolvedValue({ data: { id: null, isNew: false } });

        const response = await request(app.express).post(url).send({ event: "trade.completed" });
        await flushAsync();

        expect(response.status).toBe(200);
        expect(processWebhookEvent).not.toHaveBeenCalled();
    });
});
