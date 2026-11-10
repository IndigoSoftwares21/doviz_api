import request from "supertest";
import app from "../../src/app";
import verifyFlutterwaveWebhook from "@/services/bills/providers/flutterwave/verifyFlutterwaveWebhook";
import parseFlutterwaveWebhook from "@/services/bills/providers/flutterwave/parseFlutterwaveWebhook";
import processWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent";
import createProviderWebhookEvent from "@/actions/providerWebhookEvent/createProviderWebhookEvent";
import selectWebhookEvent from "@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWebhookEvent";
import updateWebhookEventAttempt from "@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventAttempt";
import updateWebhookEventResult from "@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventResult";
import selectBillPaymentIdByReference from "@/actions/providerWebhookEvent/processWebhookEvent/queries/selectBillPaymentIdByReference";
import syncBillPayment from "@/actions/billPayment/syncBillPayment";
import providerRegistry from "@/services/crypto/providerRegistry";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import { makeFakeBillProvider } from "./fakeBillProvider";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/actions/providerWebhookEvent/createProviderWebhookEvent");
jest.mock("@/actions/providerWebhookRejection/createProviderWebhookRejection");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/selectWebhookEvent");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventAttempt");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/updateWebhookEventResult");
jest.mock("@/actions/providerWebhookEvent/processWebhookEvent/queries/selectBillPaymentIdByReference");
jest.mock("@/actions/billPayment/syncBillPayment");

const OUR_ID = "0b6c3a3e-1f2d-4c5b-8a9e-2d4f6a8b0c1d";
const flutterwaveBody = {
    event: "singlebillpayment.status",
    "event.type": "SingleBillPayment",
    data: { customer: "+2348038291822", amount: 500, network: "MTN", tx_ref: "CF-FLYAPI-20261110", flw_ref: "BPUSSD1", customer_reference: OUR_ID, status: "success", message: "Bill Payment was completed successfully", reference: null },
};

describe("Flutterwave bill webhooks", () => {
    const original = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    afterEach(() => {
        process.env.FLUTTERWAVE_WEBHOOK_HASH = original;
    });

    it("accepts only the exact secret hash in verif-hash", () => {
        process.env.FLUTTERWAVE_WEBHOOK_HASH = "s3cret-hash";
        const verify = (header: string | undefined) => verifyFlutterwaveWebhook({ request: { headers: { "verif-hash": header }, body: {}, sourceIp: null } });
        expect(verify("s3cret-hash")).toBe(true);
        expect(verify("s3cret-hasH")).toBe(false);
        expect(verify("s3cret")).toBe(false);
        expect(verify(undefined)).toBe(false);

        delete process.env.FLUTTERWAVE_WEBHOOK_HASH;
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        expect(verify("s3cret-hash")).toBe(false);
    });

    it("parses a bill status event, pointing at our own payment id", () => {
        expect(parseFlutterwaveWebhook({ body: flutterwaveBody })).toEqual({
            eventId: "CF-FLYAPI-20261110:success",
            eventName: "singlebillpayment.status",
            resourceType: "bill_payment",
            resourceId: OUR_ID,
            eventTime: null,
        });
    });

    it("falls back to Flutterwave's tx_ref when our id isn't echoed back", () => {
        const body = { ...flutterwaveBody, data: { ...flutterwaveBody.data, customer_reference: "SOMETHING-ELSE" } };
        expect(parseFlutterwaveWebhook({ body })).toMatchObject({ resourceId: "CF-FLYAPI-20261110" });
    });

    it("marks other events as other, and rejects junk", () => {
        expect(parseFlutterwaveWebhook({ body: { event: "charge.completed", data: { tx_ref: "x", status: "successful" } } })).toMatchObject({ resourceType: "other" });
        expect(parseFlutterwaveWebhook({ body: null })).toBeNull();
        expect(parseFlutterwaveWebhook({ body: { event: "singlebillpayment.status" } })).toBeNull();
    });
});

describe("bill webhooks through the shared inbox", () => {
    const parse = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
        providerRegistry.reset();
        billProviderRegistry.reset();
        billProviderRegistry.register(makeFakeBillProvider({ parseWebhook: parse }));
        parse.mockReturnValue({ eventId: "CF-1:success", eventName: "singlebillpayment.status", resourceType: "bill_payment", resourceId: OUR_ID, eventTime: null });
    });

    afterAll(() => billProviderRegistry.reset());

    it("accepts a bill provider's webhook at /webhooks/<its name>", async () => {
        jest.mocked(createProviderWebhookEvent).mockResolvedValue({ data: { id: null, isNew: false } });
        const response = await request(app.express).post("/api/v1/webhooks/fakebills").send(flutterwaveBody);
        expect(response.status).toBe(200);
        expect(createProviderWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ provider: "fakebills" }));
    });

    it("syncs the bill payment the event points at", async () => {
        jest.mocked(selectWebhookEvent).mockResolvedValue({ id: "ev-row", provider: "fakebills", payload: flutterwaveBody, status: "received", attempts: 0 });
        jest.mocked(updateWebhookEventAttempt).mockResolvedValue({ id: "ev-row", attempts: 1 });
        jest.mocked(selectBillPaymentIdByReference).mockResolvedValue({ id: OUR_ID });
        jest.mocked(syncBillPayment).mockResolvedValue({ data: { outcome: "completed" } });

        const { data } = await processWebhookEvent({ id: "ev-row" });

        expect(selectBillPaymentIdByReference).toHaveBeenCalledWith({ provider: "fakebills", reference: OUR_ID });
        expect(syncBillPayment).toHaveBeenCalledWith({ billPaymentId: OUR_ID });
        expect(data.status).toBe("processed");
    });

    it("ignores an event for a payment we don't have", async () => {
        jest.mocked(selectWebhookEvent).mockResolvedValue({ id: "ev-row", provider: "fakebills", payload: flutterwaveBody, status: "received", attempts: 0 });
        jest.mocked(updateWebhookEventAttempt).mockResolvedValue({ id: "ev-row", attempts: 1 });
        jest.mocked(selectBillPaymentIdByReference).mockResolvedValue(undefined);

        const { data } = await processWebhookEvent({ id: "ev-row" });
        expect(syncBillPayment).not.toHaveBeenCalled();
        expect(data.status).toBe("ignored");
        expect(updateWebhookEventResult).toHaveBeenCalledWith({ id: "ev-row", status: "ignored", lastError: null });
    });
});
