const auth = [{ BearerAuth: [] }];
const tags = ["User"];
const json = (schema: object) => ({ "application/json": { schema } });
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const error = (description: string, message: string, code: number) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { message, code } } },
});
const account = {
    type: "object",
    properties: {
        status: { type: "string", enum: ["none", "active"] },
        account: {
            type: ["object", "null"],
            properties: {
                accountNumber: { type: "string", example: "0123456789" },
                accountName: { type: "string", example: "Ada Okafor" },
                bankName: { type: "string", example: "GTBank" },
            },
        },
    },
};
const ok = (message: string, code: number) => ({
    description: message,
    content: json({ type: "object", properties: { message: { type: "string", example: message }, code: { type: "integer", example: code }, data: account } }),
});

const virtualAccountPaths = {
    "/user/virtual-account": {
        get: {
            tags, summary: "My account number", operationId: "getUserVirtualAccount", security: auth,
            description: "The user's personal account number: money sent to it from any bank lands in their Ziks balance. `none` until it's created.",
            responses: { "200": ok("Account number", 200), "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError") },
        },
        post: {
            tags, summary: "Get my account number", operationId: "postUserVirtualAccount", security: auth,
            description: "Creates the account number from the user's verified KYC — or returns the one they have (`200`). It's created automatically right after verification (socket event `virtual_account.ready`); this is the retry / activate button. Idempotent. No PIN. Can take ~10–20 s. Limited to 10 per hour per user.",
            responses: {
                "201": ok("Your account number is ready", 201),
                "200": ok("Your account number", 200),
                "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "409": error("Not verified yet (or account numbers are switched off).", "Verify your identity first.", 409),
                "422": error("The provider refused the verified details — needs support.", "We couldn't open an account number with your verified details. Contact support and we'll sort it out.", 422),
                "429": ref("TooManyRequests"),
                "503": error("The provider couldn't be reached — try again.", "We couldn't create your account number right now. Please try again.", 503),
                "500": ref("ServerError"),
            },
        },
    },
};

export default virtualAccountPaths;
