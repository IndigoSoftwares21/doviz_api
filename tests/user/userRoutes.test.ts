import request from "supertest";
import app from "../../src/app";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import selectUserOverview from "@/actions/user/fetchUser/queries/selectUserOverview";
import selectUserNameStatus from "@/schemaHelpers/selectUserNameStatus";
import modifyUserName from "@/actions/userName/modifyUserName";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/user/fetchUser/queries/selectUserOverview");
jest.mock("@/schemaHelpers/selectUserNameStatus");
jest.mock("@/actions/userName/modifyUserName");

const auth = (userId = "user-1") => `Bearer ${signAccessToken({ userId, sessionId: "session-1" })}`;
const overview = (overrides = {}) => ({
    id: "user-1",
    phoneNumber: "+2348012345678",
    firstName: null,
    middleName: null,
    lastName: null,
    tag: null,
    email: null,
    emailVerifiedAt: null,
    status: "active",
    createdAt: new Date(),
    hasPin: false,
    biometricsEnabled: false,
    ...overrides,
});

describe("GET /user", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "active" });
    });

    it("requires authentication", async () => {
        const response = await request(app.express).get("/api/v1/app/user");
        expect(response.status).toBe(401);
        expect(selectUserOverview).not.toHaveBeenCalled();
    });

    it("only ever reads the token's own user — query params can't change it", async () => {
        jest.mocked(selectUserOverview).mockResolvedValue(overview());

        const response = await request(app.express)
            .get("/api/v1/app/user?userId=someone-else&id=someone-else")
            .set("Authorization", auth("user-1"));

        expect(response.status).toBe(200);
        expect(selectUserOverview).toHaveBeenCalledWith({ userId: "user-1", deviceId: "device-abc-123" });
        expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("returns the Ziktag (null until chosen)", async () => {
        jest.mocked(selectUserOverview).mockResolvedValue(overview({ tag: "ada_o" }));
        const response = await request(app.express).get("/api/v1/app/user").set("Authorization", auth());
        expect(response.body.data.tag).toBe("ada_o");
    });

    it("never exposes secrets", async () => {
        jest.mocked(selectUserOverview).mockResolvedValue(overview());

        const response = await request(app.express).get("/api/v1/app/user").set("Authorization", auth());
        const body = JSON.stringify(response.body).toLowerCase();

        expect(body).not.toMatch(/hash|pepper|refresh|token/);
    });

    it.each([
        ["no name yet", {}, "name", false],
        ["name but no PIN", { firstName: "Ada", lastName: "Lovelace" }, "pin", false],
        ["name and PIN", { firstName: "Ada", lastName: "Lovelace", hasPin: true }, null, true],
    ])("onboarding: %s", async (_label, overrides, nextStep, isComplete) => {
        jest.mocked(selectUserOverview).mockResolvedValue(overview(overrides));

        const response = await request(app.express).get("/api/v1/app/user").set("Authorization", auth());

        expect(response.body.data.onboarding).toEqual({ isComplete, nextStep });
    });

    it("blocks suspended accounts", async () => {
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "suspended" });

        const response = await request(app.express).get("/api/v1/app/user").set("Authorization", auth());

        expect(response.status).toBe(403);
        expect(selectUserOverview).not.toHaveBeenCalled();
    });
});

describe("PUT /user/name", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "device-abc-123", accountStatus: "active" });
        jest.mocked(selectUserNameStatus).mockResolvedValue({ firstName: null, hasPin: false });
    });

    it("saves the name during onboarding without a PIN", async () => {
        jest.mocked(modifyUserName).mockResolvedValue({
            data: { firstName: "Adéṣọlá", middleName: null, lastName: "Okafor-Eze", nameUpdatedAt: new Date() },
            verification: null,
        });

        const response = await request(app.express)
            .put("/api/v1/app/user/name")
            .set("Authorization", auth())
            .send({ firstName: " Adéṣọlá ", middleName: "", lastName: "Okafor-Eze" });

        expect(response.status).toBe(200);
        expect(modifyUserName).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", firstName: "Adéṣọlá", middleName: null, lastName: "Okafor-Eze" }),
        );
    });

    it("requires the PIN to change an existing name once a PIN is set", async () => {
        jest.mocked(selectUserNameStatus).mockResolvedValue({ firstName: "Ada", hasPin: true });

        const response = await request(app.express)
            .put("/api/v1/app/user/name")
            .set("Authorization", auth())
            .send({ firstName: "Ada", lastName: "Lovelace" });

        expect(response.status).toBe(400);
        expect(response.body.validationErrors[0]).toEqual({ path: ["pin"], message: "Enter your PIN to change your name" });
        expect(modifyUserName).not.toHaveBeenCalled();
    });

    it("rejects digits in a name", async () => {
        const response = await request(app.express)
            .put("/api/v1/app/user/name")
            .set("Authorization", auth())
            .send({ firstName: "Ada2", lastName: "Lovelace" });

        expect(response.status).toBe(400);
        expect(modifyUserName).not.toHaveBeenCalled();
    });
});
