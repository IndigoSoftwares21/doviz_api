import request from "supertest";
import app from "../../src/app";
import processWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent";
import createProviderWebhookEvent from "@/actions/providerWebhookEvent/createProviderWebhookEvent";
import createProviderWebhookRejection from "@/actions/providerWebhookRejection/createProviderWebhookRejection";
import selectWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWebhookEvent";
import updateWebhookEventAttempt from "@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventAttempt";
import updateWebhookEventResult from "@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventResult";
import selectNairaDepositIdByReference from "@/actions/providerWebhookEvent/processWebhookEvent/queries/selectNairaDepositIdByReference";
import syncNairaDeposit from "@/actions/nairaDeposit/syncNairaDeposit";
import providerRegistry from "@/services/crypto/providerRegistry";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import { makeFakeCollectionProvider } from "./fakeCollectionProvider";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/actions/providerWebhookEvent/createProviderWebhookEvent");
jest.mock("@/actions/providerWebhookRejection/createProviderWebhookRejection");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWebhookEvent");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventAttempt");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventResult");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/selectNairaDepositIdByReference");
jest.mock("@/actions/nairaDeposit/syncNairaDeposit");

const OUR_ID = "3b241101-e2bb-4255-8caf-4136c566a962";
const body = { event: "charge.success", data: { reference: OUR_ID, amount: 50000, fee: 375, currency: "NGN", status: "success" } };

describe("naira deposit webhooks through the shared inbox", () => {
    const parse = jest.fn();
    const verify = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
        providerRegistry.reset();
        billProviderRegistry.reset();
        collectionProviderRegistry.reset();
        collectionProviderRegistry.register(makeFakeCollectionProvider({ parseWebhook: parse, verifyWebhook: verify }));
        verify.mockReturnValue(true);
        parse.mockReturnValue({ eventId: `${OUR_ID}:charge.success`, eventName: "charge.success", resourceType: "naira_deposit", resourceId: OUR_ID, eventTime: null });
        jest.mocked(selectWebhookEvent).mockResolvedValue({ id: "ev-row", provider: "fakecollect", payload: body, status: "received", attempts: 0 });
        jest.mocked(updateWebhookEventAttempt).mockResolvedValue({ id: "ev-row", attempts: 1 });
    });

    afterAll(() => collectionProviderRegistry.reset());

    it("accepts a collection provider's webhook at /webhooks/<its name>", async () => {
        jest.mocked(createProviderWebhookEvent).mockResolvedValue({ data: { id: null, isNew: false } });
        const response = await request(app.express).post("/api/v1/webhooks/fakecollect").send(body);
        expect(response.status).toBe(200);
        expect(createProviderWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ provider: "fakecollect" }));
    });

    it("rejects an unverified webhook without storing it", async () => {
        verify.mockReturnValue(false);
        const response = await request(app.express).post("/api/v1/webhooks/fakecollect").send(body);
        expect(response.status).toBe(401);
        expect(createProviderWebhookRejection).toHaveBeenCalled();
        expect(createProviderWebhookEvent).not.toHaveBeenCalled();
    });

    it("syncs the deposit the event points at", async () => {
        jest.mocked(selectNairaDepositIdByReference).mockResolvedValue({ id: OUR_ID });
        jest.mocked(syncNairaDeposit).mockResolvedValue({ data: { outcome: "credited" } });

        const { data } = await processWebhookEvent({ id: "ev-row" });

        expect(selectNairaDepositIdByReference).toHaveBeenCalledWith({ provider: "fakecollect", reference: OUR_ID });
        expect(syncNairaDeposit).toHaveBeenCalledWith({ nairaDepositId: OUR_ID });
        expect(data.status).toBe("processed");
    });

    it("ignores an event for a deposit we don't have", async () => {
        jest.mocked(selectNairaDepositIdByReference).mockResolvedValue(undefined);
        const { data } = await processWebhookEvent({ id: "ev-row" });
        expect(syncNairaDeposit).not.toHaveBeenCalled();
        expect(updateWebhookEventResult).toHaveBeenCalledWith({ id: "ev-row", status: "ignored", lastError: null });
        expect(data.status).toBe("ignored");
    });
});
