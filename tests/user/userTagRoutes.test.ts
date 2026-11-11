import request from "supertest";
import app from "../../src/app";
import signAccessToken from "@/utils/auth/signAccessToken";
import selectActiveSession from "@/middlewares/requireAuth/queries/selectActiveSession";
import fetchTagAvailability from "@/actions/userTag/fetchTagAvailability";
import fetchTagSuggestions from "@/actions/userTag/fetchTagSuggestions";
import modifyUserTag from "@/actions/userTag/modifyUserTag";
import tagUnavailableReason from "@/schemaHelpers/tagUnavailableReason";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/middlewares/requireAuth/queries/selectActiveSession");
jest.mock("@/actions/userTag/fetchTagAvailability");
jest.mock("@/actions/userTag/fetchTagSuggestions");
jest.mock("@/actions/userTag/modifyUserTag");
jest.mock("@/schemaHelpers/tagUnavailableReason");

let userNumber = 0;
const auth = (userId = `user-${(userNumber += 1)}`) => `Bearer ${signAccessToken({ userId, sessionId: "session-1" })}`;
const put = (body: object, token = auth()) => request(app.express).put("/api/v1/app/user/tag").set("Authorization", token).send(body);
const failed = (failure: string, extra = {}) => ({ data: null, failure, ...extra }) as never;

describe("Ziktag routes", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(selectActiveSession).mockResolvedValue({ id: "session-1", deviceId: "d-1", accountStatus: "active" });
        jest.mocked(tagUnavailableReason).mockResolvedValue({ tag: "ada_o", reason: null });
    });
    const tagError = (body: { validationErrors?: { path: string[]; message: string }[] }) => body.validationErrors?.find((e) => e.path[0] === "tag")?.message;

    it("checks availability without saying who owns it, and needs auth", async () => {
        jest.mocked(fetchTagAvailability).mockResolvedValue({ data: { tag: "ada", available: false, reason: "taken", suggestions: ["ada_ng"] } } as never);
        const response = await request(app.express).get("/api/v1/app/user/tag/check?tag=@Ada").set("Authorization", auth("user-check"));
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ tag: "ada", available: false, reason: "taken", suggestions: ["ada_ng"] });
        expect(fetchTagAvailability).toHaveBeenCalledWith({ userId: "user-check", value: "@Ada" });

        expect((await request(app.express).get("/api/v1/app/user/tag/check?tag=ada")).status).toBe(401);
        expect((await request(app.express).get("/api/v1/app/user/tag/check").set("Authorization", auth())).status).toBe(400);
    });

    it("rate-limits checks per user (30 per 10 minutes)", async () => {
        jest.mocked(fetchTagAvailability).mockResolvedValue({ data: { tag: "ada", available: true, reason: null, suggestions: [] } } as never);
        const token = auth("user-flood");
        for (let i = 0; i < 30; i++) await request(app.express).get("/api/v1/app/user/tag/check?tag=ada").set("Authorization", token);
        expect((await request(app.express).get("/api/v1/app/user/tag/check?tag=ada").set("Authorization", token)).status).toBe(429);
        expect((await request(app.express).get("/api/v1/app/user/tag/check?tag=ada").set("Authorization", auth("user-other"))).status).toBe(200);
    });

    it("suggests tags", async () => {
        jest.mocked(fetchTagSuggestions).mockResolvedValue({ data: { suggestions: ["adaokafor", "ada_o"] } });
        const response = await request(app.express).get("/api/v1/app/user/tag/suggestions").set("Authorization", auth());
        expect(response.body.data.suggestions).toEqual(["adaokafor", "ada_o"]);
    });

    it("saves a tag and never echoes the PIN", async () => {
        const changedAt = new Date("2026-11-11T12:00:00.000Z");
        jest.mocked(modifyUserTag).mockResolvedValue({ data: { tag: "ada_o", changedAt, nextChangeAt: new Date("2026-12-11T12:00:00.000Z") }, failure: null } as never);
        const response = await put({ tag: "@Ada_O", pin: "4827" }, auth("user-save"));
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ tag: "ada_o", changedAt: changedAt.toISOString(), nextChangeAt: "2026-12-11T12:00:00.000Z" });
        expect(JSON.stringify(response.body)).not.toContain("4827");
        expect(modifyUserTag).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-save", value: "@Ada_O", pin: "4827" }));
    });

    it.each([
        ["invalid", "Use 3–20 letters, numbers or underscores, starting with a letter"],
        ["reserved", "That Ziktag isn't available"],
        ["taken", "That Ziktag is taken"],
    ] as const)("refuses a %s tag in validation — 400 on `tag`, before the action runs", async (reason, message) => {
        jest.mocked(tagUnavailableReason).mockResolvedValue({ tag: "x", reason });
        const response = await put({ tag: "whatever" }, auth("user-v"));
        expect(response.status).toBe(400);
        expect(tagError(response.body)).toBe(message);
        expect(tagUnavailableReason).toHaveBeenCalledWith({ value: "whatever", userId: "user-v" });
        expect(modifyUserTag).not.toHaveBeenCalled();
    });

    it.each([
        ["taken", {}, "That Ziktag is taken"], // lost a race the database caught: same shape as validation
        ["reserved", {}, "That Ziktag isn't available"],
        ["cooldown", { nextChangeAt: new Date("2026-12-11T12:00:00.000Z") }, "You can change your Ziktag again on 11 December 2026"],
    ])("maps the action's %s to 400 validation on `tag`", async (failure, extra, message) => {
        jest.mocked(modifyUserTag).mockResolvedValue(failed(failure, extra));
        const response = await put({ tag: "ada_o" });
        expect(response.status).toBe(400);
        expect(tagError(response.body)).toBe(message);
    });

    it.each([
        ["pin_required", {}, 400],
        ["pin", { verification: { status: "invalid", remainingAttempts: 2 } }, 400],
        ["pin", { verification: { status: "locked", lockedUntil: new Date(Date.now() + 60_000) } }, 423],
    ])("maps %s to %i", async (failure, extra, status) => {
        jest.mocked(modifyUserTag).mockResolvedValue(failed(failure, extra));
        const response = await put({ tag: "ada_o" });
        expect(response.status).toBe(status);
        if (failure === "pin_required") expect(response.body.validationErrors[0]).toMatchObject({ path: ["pin"], message: "Enter your PIN to change your Ziktag" });
    });

    it("rate-limits saves per user (10 per hour)", async () => {
        jest.mocked(modifyUserTag).mockResolvedValue(failed("taken"));
        const token = auth("user-spam");
        for (let i = 0; i < 10; i++) await put({ tag: "ada_o" }, token);
        expect((await put({ tag: "ada_o" }, token)).status).toBe(429);
    });
});
