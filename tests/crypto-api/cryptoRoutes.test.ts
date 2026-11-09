import request from "supertest";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectEnabledProviderAsset from "@/schemaHelpers/selectEnabledProviderAsset";
import selectUserLegalName from "@/schemaHelpers/selectUserLegalName";
import selectCryptoAssets from "@/actions/cryptoAssets/fetchCryptoAssets/queries/selectCryptoAssets";
import selectCurrentConversionMarkup from "@/actions/cryptoQuote/fetchCryptoQuote/queries/selectCurrentConversionMarkup";
import selectQuoteAsset from "@/actions/cryptoQuote/fetchCryptoQuote/queries/selectQuoteAsset";
import createCryptoWallet from "@/actions/cryptoWallet/createCryptoWallet";
import { useFakeProvider } from "./fakeProvider";
import { ASSET_ID, authHeader, createTestApp } from "./testApp";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/schemaHelpers/selectEnabledProviderAsset");
jest.mock("@/schemaHelpers/selectUserLegalName");
jest.mock("@/actions/cryptoAssets/fetchCryptoAssets/queries/selectCryptoAssets");
jest.mock("@/actions/cryptoQuote/fetchCryptoQuote/queries/selectCurrentConversionMarkup");
jest.mock("@/actions/cryptoQuote/fetchCryptoQuote/queries/selectQuoteAsset");
jest.mock("@/actions/cryptoWallet/createCryptoWallet");

const app = createTestApp();
const get = (path: string) => request(app).get(`/api/v1/app/crypto${path}`).set("Authorization", authHeader());
const quote = (cryptoAmount: string) => get(`/quote?assetId=${ASSET_ID}&cryptoAmount=${cryptoAmount}`);

describe("crypto routes", () => {
    let provider: ReturnType<typeof useFakeProvider>;
    beforeEach(() => {
        jest.resetAllMocks();
        provider = useFakeProvider();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
        jest.mocked(selectEnabledProviderAsset).mockResolvedValue({ id: ASSET_ID, symbol: "USDT", network: "TRC20", decimals: 6, providerAssetId: "pa-1", providerCode: "TRX_USDT" });
        jest.mocked(selectQuoteAsset).mockResolvedValue({ providerAssetId: "pa-1" });
        jest.mocked(selectCurrentConversionMarkup).mockResolvedValue({ id: "m-1", markupPercent: "2.500", effectiveFrom: new Date() });
        provider.getQuote.mockResolvedValue({ grossNgn: "160000.00", rateNgnPerUsd: "1600" });
    });

    it("requires authentication", async () => {
        expect((await request(app).get("/api/v1/app/crypto/assets")).status).toBe(401);
    });

    it("lists assets for the active provider, uncached", async () => {
        jest.mocked(selectCryptoAssets).mockResolvedValue([]);
        const response = await get("/assets");
        expect(response.status).toBe(200);
        expect(selectCryptoAssets).toHaveBeenCalledWith({ provider: "fakeprov", environment: "sandbox" });
        expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("quotes gross, markup and net as exact strings", async () => {
        const response = await quote("100");
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ grossNgn: "160000.00", markupNgn: "4000.00", netNgn: "156000.00", isEstimate: true });
    });

    it("refuses to quote with no markup configured (never 0%)", async () => {
        jest.mocked(selectCurrentConversionMarkup).mockResolvedValue(undefined);
        const response = await quote("101");
        expect(response.status).toBe(503);
        expect(provider.getQuote).not.toHaveBeenCalled();
    });

    it("rejects amounts finer than the coin's decimals", async () => {
        const response = await quote("0.0000001");
        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0].path).toEqual(["cryptoAmount"]);
    });

    it("requires a finished onboarding to create an address", async () => {
        jest.mocked(selectUserLegalName).mockResolvedValue({ firstName: "Ada", lastName: null, hasPin: true });
        const response = await request(app).post("/api/v1/app/crypto/wallets").set("Authorization", authHeader()).send({ assetId: ASSET_ID });
        expect(response.status).toBe(400);
        expect(createCryptoWallet).not.toHaveBeenCalled();
    });

    it("returns 503 when the provider can't issue an address yet", async () => {
        jest.mocked(selectUserLegalName).mockResolvedValue({ firstName: "Ada", lastName: "Okafor", hasPin: true });
        jest.mocked(createCryptoWallet).mockResolvedValue({ data: null, failure: "provider_unavailable" });
        const response = await request(app).post("/api/v1/app/crypto/wallets").set("Authorization", authHeader()).send({ assetId: ASSET_ID });
        expect(response.status).toBe(503);
    });
});
