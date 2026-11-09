import parseBreetWebhook from "@/services/crypto/providers/breet/parseBreetWebhook";
import verifyBreetWebhook from "@/services/crypto/providers/breet/verifyBreetWebhook";

const SECRET = "breet_whsec_test_bJvWISpL9WvpZw0coXdHxMZwD3n303ra615UsVQjZc";
const request = (secret: string | undefined, sourceIp = "46.101.201.155") => ({
    headers: secret === undefined ? {} : { "x-webhook-secret": secret },
    body: {},
    sourceIp,
});

describe("verifyBreetWebhook", () => {
    const env = { ...process.env };
    beforeEach(() => {
        process.env.BREET_WEBHOOK_SECRET = SECRET;
        delete process.env.BREET_ENFORCE_WEBHOOK_IP;
    });
    afterAll(() => {
        process.env = env;
    });

    it("accepts the right secret", () => expect(verifyBreetWebhook({ request: request(SECRET) })).toBe(true));
    it("rejects a wrong secret of the same length", () =>
        expect(verifyBreetWebhook({ request: request(SECRET.replace(/.$/, "X")) })).toBe(false));
    it("rejects a secret of a different length", () => expect(verifyBreetWebhook({ request: request("short") })).toBe(false));
    it("rejects a missing header", () => expect(verifyBreetWebhook({ request: request(undefined) })).toBe(false));
    it("rejects everything when no secret is configured", () => {
        delete process.env.BREET_WEBHOOK_SECRET;
        expect(verifyBreetWebhook({ request: request(SECRET) })).toBe(false);
    });

    it("enforces Breet's IPs only when switched on (IPv4-mapped IPv6 allowed)", () => {
        expect(verifyBreetWebhook({ request: request(SECRET, "1.2.3.4") })).toBe(true);
        process.env.BREET_ENFORCE_WEBHOOK_IP = "true";
        expect(verifyBreetWebhook({ request: request(SECRET, "1.2.3.4") })).toBe(false);
        expect(verifyBreetWebhook({ request: request(SECRET, "::ffff:159.89.20.62") })).toBe(true);
    });
});

describe("parseBreetWebhook (docs examples)", () => {
    it("trade.completed → deposit", () => {
        const body = { id: "692f91aa729255932afe9078", event: "trade.completed", eventId: "e3f2a9c4-71bd-4a08-9f3e-5c2d81b0a417", eventTime: "2025-12-01T18:44:15.493Z", status: "completed" };
        expect(parseBreetWebhook({ body })).toEqual({
            eventId: "e3f2a9c4-71bd-4a08-9f3e-5c2d81b0a417",
            eventName: "trade.completed",
            resourceType: "deposit",
            resourceId: "692f91aa729255932afe9078",
            eventTime: new Date("2025-12-01T18:44:15.493Z"),
        });
    });

    it("trade.flagged → deposit", () => {
        const body = { id: "t1", event: "trade.flagged", eventId: "ev-1", eventTime: "2025-12-01T18:44:15.493Z", balanceRemaining: 7 };
        expect(parseBreetWebhook({ body })).toMatchObject({ resourceType: "deposit", resourceId: "t1" });
    });

    it("trade.address.created → other", () => {
        const body = { event: "trade.address.created", eventId: "8b4c7d21", eventTime: "2026-01-15T13:35:15.967Z", id: "6a1e1281ab08f50ad3127259", label: "user-12345" };
        expect(parseBreetWebhook({ body })).toMatchObject({ resourceType: "other", resourceId: "6a1e1281ab08f50ad3127259" });
    });

    it("withdrawal.pending → payout", () => {
        const body = { id: "6968ed1398fea49e805363bb", event: "withdrawal.pending", eventId: "2d7f0b54", eventTime: "2026-01-15T13:35:15.967Z" };
        expect(parseBreetWebhook({ body })).toMatchObject({ resourceType: "payout", resourceId: "6968ed1398fea49e805363bb" });
    });

    it.each([[null], ["text"], [{}], [{ event: "trade.completed" }], [{ eventId: "x" }]])("returns null for malformed %p", (body) => {
        expect(parseBreetWebhook({ body })).toBeNull();
    });

    it("tolerates a bad eventTime", () => {
        expect(parseBreetWebhook({ body: { event: "trade.pending", eventId: "e", id: "t", eventTime: "nope" } })?.eventTime).toBeNull();
    });
});
