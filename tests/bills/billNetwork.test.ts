import express from "express";
import request from "supertest";
import billRoutes from "@/routes/bill.routes";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectNetworkBillers from "@/actions/billNetwork/fetchBillNetwork/queries/selectNetworkBillers";
import detectMobileNetwork from "@/utils/bills/detectMobileNetwork";
import toLocalPhoneNumber from "@/utils/bills/toLocalPhoneNumber";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import { makeFakeBillProvider } from "./fakeBillProvider";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/billNetwork/fetchBillNetwork/queries/selectNetworkBillers");

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

describe("toLocalPhoneNumber", () => {
    it.each([
        ["08126257120", "08126257120"],
        ["+2348126257120", "08126257120"],
        ["2348126257120", "08126257120"],
        ["8126257120", "08126257120"],
        ["+234 812 625 7120", "08126257120"],
        ["0812-625-7120", "08126257120"],
        ["0812625712", null],
        ["06126257120", null],
        ["+4479460000", null],
        ["0812abc7120", null],
    ])("%s → %s", (value, expected) => {
        expect(toLocalPhoneNumber({ value })).toBe(expected);
    });
});

describe("detectMobileNetwork", () => {
    it.each([
        ["08141651431", "mtn"],
        ["08031234567", "mtn"],
        ["09161234567", "mtn"],
        ["07025123456", "mtn"],
        ["08126257120", "airtel"],
        ["09021234567", "airtel"],
        ["08051234567", "glo"],
        ["09151234567", "glo"],
        ["08091234567", "9mobile"],
        ["09091234567", "9mobile"],
        ["07021234567", null],
        ["08041234567", null],
    ])("%s → %s", (phone, code) => {
        expect(detectMobileNetwork({ phone })?.code ?? null).toBe(code);
    });
});

describe("GET /bills/networks/detect", () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/app/bills", billRoutes);
    const get = (query: string) =>
        request(app).get(`/api/v1/app/bills/networks/detect${query}`).set("Authorization", `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`);

    beforeEach(() => {
        jest.resetAllMocks();
        billProviderRegistry.reset();
        billProviderRegistry.register(makeFakeBillProvider());
        process.env.BILLS_PROVIDER = "fakebills";
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
    });

    afterAll(() => billProviderRegistry.reset());

    it("returns the network and our billers for it, by our own slugs", async () => {
        jest.mocked(selectNetworkBillers).mockResolvedValue([
            { id: "air-1", slug: "airtel-airtime", categoryCode: "airtime" },
            { id: "data-1", slug: "airtel-data", categoryCode: "data" },
        ]);

        const response = await get("?phone=%2B234%20812%20625%207120");
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ phone: "08126257120", network: { code: "airtel", name: "Airtel" }, airtimeBillerId: "air-1", dataBillerId: "data-1" });
        expect(selectNetworkBillers).toHaveBeenCalledWith({ slugs: ["airtel-airtime", "airtel-data"], provider: "fakebills", environment: "sandbox" });
    });

    it("leaves a biller null when that network can't be paid right now", async () => {
        jest.mocked(selectNetworkBillers).mockResolvedValue([{ id: "air-1", slug: "mtn-airtime", categoryCode: "airtime" }]);
        const response = await get("?phone=08141651431");
        expect(response.body.data).toMatchObject({ network: { code: "mtn" }, airtimeBillerId: "air-1", dataBillerId: null });
    });

    it("answers 200 with no network for an unknown prefix, without querying", async () => {
        const response = await get("?phone=07021234567");
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ message: "Network not recognised", data: { network: null, airtimeBillerId: null, dataBillerId: null } });
        expect(selectNetworkBillers).not.toHaveBeenCalled();
    });

    it("rejects something that isn't a Nigerian mobile number", async () => {
        const response = await get("?phone=12345");
        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0]).toEqual({ path: ["phone"], message: "Enter a valid Nigerian mobile number" });
    });
});
