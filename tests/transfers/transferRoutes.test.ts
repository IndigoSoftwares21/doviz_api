import request from "supertest";
import app from "../../src/app";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectRecipientByTag from "@/actions/transferRecipient/fetchTransferRecipient/queries/selectRecipientByTag";
import fetchTransferLimits from "@/actions/transferLimits/fetchTransferLimits";
import createTransfer from "@/actions/transfer/createTransfer";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/transferRecipient/fetchTransferRecipient/queries/selectRecipientByTag");
jest.mock("@/actions/transferLimits/fetchTransferLimits");
jest.mock("@/actions/transfer/createTransfer");

const SENDER = "0b6c2f1e-1111-4c5e-9f7a-1b2c3d4e5f60";
const RECIPIENT = "0b6c2f1e-2222-4c5e-9f7a-1b2c3d4e5f60";
let userNumber = 0;
const auth = (userId = `${SENDER.slice(0, -2)}${String((userNumber += 1) % 100).padStart(2, "0")}`) => `Bearer ${signAccessToken({ userId, sessionId: "session-1" })}`;
const lookup = (tag: string, token = auth()) => request(app.express).get(`/api/v1/app/transfers/recipients?tag=${encodeURIComponent(tag)}`).set("Authorization", token);
const send = (body: object, token = auth(SENDER)) => request(app.express).post("/api/v1/app/transfers").set("Authorization", token).send(body);
const body = (overrides = {}) => ({ recipientId: RECIPIENT, amount: "5000", note: "  for lunch ", idempotencyKey: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60", pin: "4827", ...overrides });
const limits = (sentToday = "0.00") => ({ data: { currency: "NGN", minAmount: "100.00", maxPerTransfer: "1000000.00", maxPerDay: "1000000.00", sentToday, remainingToday: "x" } });
const outcome = (fields: object) => ({ data: null, failure: null, message: null, isNew: false, verification: { status: "verified" }, ...fields }) as never;
const amountError = (res: request.Response) => res.body.validationErrors?.find((e: { path: string[] }) => e.path[0] === "amount")?.message;

describe("transfer routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
        jest.mocked(fetchTransferLimits).mockResolvedValue(limits() as never);
    });

    it("lookup: exact match on the normalised tag; only a masked name comes back", async () => {
        jest.mocked(selectRecipientByTag).mockResolvedValue({ id: RECIPIENT, tag: "ada", firstName: "Ada", lastName: "Okafor" });
        const response = await lookup("  @Ada ", auth(SENDER));
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ recipientId: RECIPIENT, tag: "ada", displayName: "Ada O.", initials: "AO" });
        expect(selectRecipientByTag).toHaveBeenCalledWith({ tag: "ada", viewerId: SENDER });
        expect(JSON.stringify(response.body)).not.toMatch(/Okafor|phone/i);
    });

    it("lookup: every 'can't pay' reason is the same 404; a malformed tag is a 400", async () => {
        jest.mocked(selectRecipientByTag).mockResolvedValue(undefined);
        const missing = await lookup("ghost");
        expect(missing.status).toBe(404);
        expect(missing.body).toEqual({ message: "No Ziks user with that Ziktag", code: 404 });
        expect((await lookup("1bad")).status).toBe(400);
        expect((await request(app.express).get("/api/v1/app/transfers/recipients?tag=ada")).status).toBe(401);
    });

    it("lookup is limited to 30 per 10 minutes per user", async () => {
        jest.mocked(selectRecipientByTag).mockResolvedValue(undefined);
        const token = auth("0b6c2f1e-9999-4c5e-9f7a-1b2c3d4e5f60");
        for (let i = 0; i < 30; i += 1) expect((await lookup("ghost", token)).status).toBe(404);
        expect((await lookup("ghost", token)).status).toBe(429);
        expect((await lookup("ghost")).status).toBe(404); // someone else isn't affected
    });

    it("send: limits fail on the amount field at the validation layer, before the PIN", async () => {
        jest.mocked(fetchTransferLimits).mockResolvedValue(limits("360000.00") as never);
        const response = await send(body({ amount: "700000" }));
        expect(response.status).toBe(400);
        expect(amountError(response)).toBe("You can send up to ₦640,000 more today");
        expect(amountError(await send(body({ amount: "50" })))).toBe("The minimum transfer is ₦100");
        expect(amountError(await send(body({ amount: "12.345" })))).toBe("Enter a valid amount");
        expect(createTransfer).not.toHaveBeenCalled();
    });

    it("send: refuses yourself, a long note and a missing key", async () => {
        const self = await send(body({ recipientId: SENDER }));
        expect(self.status).toBe(400);
        expect(self.body.validationErrors[0]).toMatchObject({ path: ["recipientId"], message: "You can't send money to yourself" });
        expect((await send(body({ note: "x".repeat(101) }))).status).toBe(400);
        expect((await send(body({ idempotencyKey: undefined }))).status).toBe(400);
        expect(createTransfer).not.toHaveBeenCalled();
    });

    it("send: 201 with the transfer; the note is trimmed; a replay is 200", async () => {
        const transfer = { id: "t-1", amount: "5000.00", status: "completed", direction: "sent" };
        jest.mocked(createTransfer).mockResolvedValue(outcome({ data: transfer, isNew: true }));
        const response = await send(body());
        expect(response.status).toBe(201);
        expect(response.body.data).toEqual(transfer);
        expect(createTransfer).toHaveBeenCalledWith(expect.objectContaining({ senderId: SENDER, recipientId: RECIPIENT, amount: "5000", note: "for lunch", pin: "4827" }));

        jest.mocked(createTransfer).mockResolvedValue(outcome({ data: transfer, isNew: false }));
        expect((await send(body())).status).toBe(200);
    });

    it("send: maps the action's outcomes", async () => {
        const status = async (fields: object) => {
            jest.mocked(createTransfer).mockResolvedValue(outcome(fields));
            return send(body());
        };
        expect((await status({ failure: "insufficient_balance" })).status).toBe(402);
        expect((await status({ failure: "recipient_unavailable" })).body).toEqual({ message: "No Ziks user with that Ziktag", code: 404 });
        expect((await status({ failure: "account_inactive" })).status).toBe(403);
        const raced = await status({ failure: "transfer_limit", message: "You can send up to ₦1,000 more today" });
        expect([raced.status, amountError(raced)]).toEqual([400, "You can send up to ₦1,000 more today"]);
        const wrongPin = await status({ failure: "pin", verification: { status: "invalid", remainingAttempts: 2 } });
        expect(wrongPin.body).toEqual({ message: "Incorrect PIN. 2 attempts remaining.", code: 400 });
    });
});
