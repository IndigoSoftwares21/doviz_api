const auth = [{ BearerAuth: [] }];
const tags = ["User"];
const json = (schema: object) => ({ "application/json": { schema } });
const ok = (message: string, data: object) => ({
    description: message,
    content: json({ type: "object", properties: { message: { type: "string", example: message }, code: { type: "integer", example: 200 }, data } }),
});
const error = (description: string, message: string, code: number) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { message, code } } },
});
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const tag = { type: "string", example: "ada_o", description: "Lowercase, without \"@\". 3–20 letters, numbers or underscores, starting with a letter." };
const rules = "Ziktags are payments identifiers: reserved and official-sounding tags (starting or ending with ziks, support, admin, official, help, security, staff, team, verify, refund) and offensive words are refused as `reserved`. Answers never say who owns a tag.";

const ziktagPaths = {
    "/user/tag/check": {
        get: {
            tags, summary: "Is a Ziktag available?", operationId: "getTagCheck", security: auth,
            description: `Input is normalised (trimmed, one leading "@" dropped, lowercased). The user's own current tag counts as available. ${rules} Limited to 30 checks per 10 minutes per user.`,
            parameters: [{ name: "tag", in: "query", required: true, schema: { type: "string", example: "@Ada_O" } }],
            responses: {
                "200": ok("Ziktag checked", { type: "object", properties: {
                    tag, available: { type: "boolean" },
                    reason: { type: ["string", "null"], enum: [null, "taken", "reserved", "invalid"] },
                    suggestions: { type: "array", items: tag, description: "Up to 3 available alternatives; empty when available." },
                } }),
                "400": { description: "Missing or too long.", content: json({ $ref: "#/components/schemas/ValidationError" }) }, "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "429": ref("TooManyRequests"), "500": ref("ServerError"),
            },
        },
    },
    "/user/tag/suggestions": {
        get: {
            tags, summary: "Ziktag ideas", operationId: "getTagSuggestions", security: auth,
            description: "Up to 5 AVAILABLE Ziktags built from the user's name (e.g. adaokafor, ada_okafor, ada_o), for the onboarding step.",
            responses: {
                "200": ok("Ziktag suggestions", { type: "object", properties: { suggestions: { type: "array", items: tag } } }),
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/user/tag": {
        put: {
            tags, summary: "Set or change my Ziktag", operationId: "putUserTag", security: auth,
            description: `First set (onboarding): no PIN, no waiting. **Changing** an existing tag needs the transfer PIN (same lockout as payments) and is allowed once every 30 days; the old tag is held for you for 30 days. Setting the tag you already have changes nothing. ${rules} Limited to 10 attempts per hour per user.`,
            requestBody: { required: true, content: json({ type: "object", required: ["tag"], properties: { tag: { type: "string", example: "@ada_o" }, pin: { $ref: "#/components/schemas/Pin" } } }) },
            responses: {
                "200": ok("Ziktag saved", { type: "object", properties: {
                    tag, changedAt: { type: ["string", "null"], format: "date-time" },
                    nextChangeAt: { type: ["string", "null"], format: "date-time", description: "When it can next be changed." },
                } }),
                "400": {
                    description: "Validation. `validationErrors` on `tag`: \"Use 3–20 letters, numbers or underscores, starting with a letter\", \"That Ziktag isn't available\" (reserved/blocked), \"That Ziktag is taken\" (taken, or on hold for its previous owner — also when two people race for it), or \"You can change your Ziktag again on <date>\". On `pin`: \"Enter your PIN to change your Ziktag\". A wrong PIN is a plain 400 with remaining attempts.",
                    content: json({ $ref: "#/components/schemas/ValidationError" }),
                },
                "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "423": ref("PinLocked"), "429": ref("TooManyRequests"), "500": ref("ServerError"),
            },
        },
    },
};

export default ziktagPaths;
