import request from "supertest";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectUserNairaBalance from "@/actions/walletBalance/fetchWalletBalance/queries/selectUserNairaBalance";
import selectIncomingDeposits from "@/actions/walletIncoming/fetchIncomingDeposits/queries/selectIncomingDeposits";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";
import { useFakeProvider } from "./fakeProvider";
import { authHeader, createTestApp } from "./testApp";

jest.mock("@/database", () => ({ db: {}, withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/walletBalance/fetchWalletBalance/queries/selectUserNairaBalance");
jest.mock("@/actions/walletIncoming/fetchIncomingDeposits/queries/selectIncomingDeposits");

const app = createTestApp();
const get = (path: string) => request(app).get(`/api/v1/app/wallet${path}`).set("Authorization", authHeader());

describe("wallet balance and incoming routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        useFakeProvider();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
    });

    it("shows 0.00 before the first credit", async () => {
        jest.mocked(selectUserNairaBalance).mockResolvedValue(undefined);
        const response = await get("/balance");
        expect(response.body.data).toEqual({ currency: "NGN", available: "0.00" });
        expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("returns the ledger balance as an exact string", async () => {
        jest.mocked(selectUserNairaBalance).mockResolvedValue({ balance: "156000.25" });
        const response = await get("/balance");
        expect(response.body.data.available).toBe("156000.25");
    });

    it("lists uncredited deposits with a normalised crypto amount", async () => {
        jest.mocked(selectIncomingDeposits).mockResolvedValue([{
            id: "dep-1", status: DEPOSIT_STATUS.PENDING, subStatus: null, symbol: "USDT", network: "TRC20",
            cryptoAmount: "100.000000", confirmations: 3, txHash: "0xabc", detectedAt: new Date(),
        }]);
        const response = await get("/incoming");
        expect(selectIncomingDeposits).toHaveBeenCalledWith({ userId: "user-1" });
        expect(response.body.data).toEqual([expect.objectContaining({ id: "dep-1", status: "pending", cryptoAmount: "100" })]);
        expect(response.headers["cache-control"]).toBe("no-store");
    });
});
