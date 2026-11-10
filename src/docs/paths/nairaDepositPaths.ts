import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";
import NAIRA_DEPOSITS, { FEE_BEARER, NAIRA_DEPOSIT_STATUS } from "@/constants/nairaDeposits";

const auth = [{ BearerAuth: [] }];
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const error = (description: string, message: string, code: number) => ({
    description,
    content: jsonContent({ schema: { $ref: "#/components/schemas/Error" }, example: { message, code } }),
});
const validation = { description: "Validation failed.", content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }) };
const money = (example: string | null, description?: string) => ({
    type: example === null ? ["string", "null"] : "string",
    pattern: "^[0-9]+\\.[0-9]{2}$",
    example,
    ...(description ? { description } : {}),
});

export const nairaDepositTags = [
    {
        name: "Naira deposits",
        description: `Top up the naira balance by bank transfer to a one-time account.

**Flow:** the user enters how much they want to receive → \`POST /naira-deposits\` → show the account card: \`bankAccount\`, the exact \`amountToTransfer\` (copy buttons) and a countdown to \`expiresAt\` → the user transfers from their bank app → the balance is credited when the transfer lands.

**Fees:** \`fee\` is the payment provider's own fee for this transfer. When \`feeBearer\` is \`user\` (the default) it's already included in \`amountToTransfer\` — show "includes ₦X transfer fee"; the user receives exactly \`amount\`. When it's \`doviz\`, \`amountToTransfer\` equals \`amount\`.

**Result (Socket.IO, same connection as bills):**
- \`naira_deposit.updated\` \`{ nairaDepositId, status }\` — \`completed\` (credited: show \`amountCredited\`), \`expired\` or \`failed\`.
- \`wallet.balance_changed\` \`{}\` — refetch the balance.

An \`expired\` account can still be paid late (the bank may be slow); it's credited if the money arrives within a day. The account is only shown while the deposit is \`pending\`.

**Resuming:** \`GET /naira-deposits/active\` returns the deposit in progress (or null) — call it on launch/foreground so a crash, a closed app, a reinstall or another device never loses the account card. Store the \`idempotencyKey\` BEFORE sending the POST: if the app dies mid-request, retrying with it returns the same account.

Send a new UUID \`idempotencyKey\` per deposit and reuse it only to retry after a timeout — the retry returns the same account.`,
    },
];

const nairaDeposit = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        status: { type: "string", enum: Object.values(NAIRA_DEPOSIT_STATUS), example: "pending" },
        currency: { type: "string", example: "NGN" },
        amount: money("50000.00", "What the user asked to receive."),
        fee: money("375.00", "The provider's fee for this transfer."),
        feeBearer: { type: "string", enum: Object.values(FEE_BEARER), example: "user" },
        amountToTransfer: money("50375.00", "Exactly what to send to `bankAccount`."),
        amountCredited: money(null, "What reached the balance, once completed."),
        bankAccount: {
            type: ["object", "null"],
            description: "Only while `pending`.",
            properties: { accountName: { type: "string", example: "Doviz Checkout" }, accountNumber: { type: "string", example: "9876543210" }, bankName: { type: "string", example: "Wema Bank" } },
        },
        expiresAt: { type: "string", format: "date-time" },
        expiresInSeconds: { type: "integer", example: 1742, description: "Seconds left to pay, by the server's clock (0 unless `pending`). Drive the countdown from this, not the phone's clock." },
        failureReason: { type: ["string", "null"] },
        createdAt: { type: "string", format: "date-time" },
        completedAt: { type: ["string", "null"], format: "date-time" },
    },
};

const nairaDepositPaths = {
    "/naira-deposits": {
        post: {
            tags: ["Naira deposits"], summary: "Start a bank transfer deposit", operationId: "postNairaDeposit", security: auth,
            description: `Issues a one-time account for this amount (₦${NAIRA_DEPOSITS.MIN_AMOUNT}–₦${NAIRA_DEPOSITS.MAX_AMOUNT}). No PIN — no money leaves the user. Returns \`201\` for a new deposit, or \`200\` with the original when the \`idempotencyKey\` was already used.`,
            requestBody: { required: true, content: jsonContent({
                schema: { type: "object", required: ["amount", "idempotencyKey"], properties: {
                    amount: { type: "string", example: "50000.00", description: "What the user wants to receive." },
                    idempotencyKey: { type: "string", format: "uuid", description: "New per deposit; reuse it only to retry the same deposit." },
                } },
                example: { amount: "50000.00", idempotencyKey: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" },
            }) },
            responses: {
                "201": { description: "Account issued.", content: jsonContent({ schema: dataEnvelope({ message: "Transfer details ready", code: 201, data: nairaDeposit }) }) },
                "200": { description: "This idempotencyKey was already used — the original deposit.", content: jsonContent({ schema: dataEnvelope({ message: "Deposit already started", code: 200, data: nairaDeposit }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
                "503": error("No provider could issue an account right now.", "Bank transfer deposits are temporarily unavailable. Please try again shortly.", 503),
            },
        },
        get: {
            tags: ["Naira deposits"], summary: "My naira deposits", operationId: "getNairaDeposits", security: auth,
            description: "Newest first. Use `hasMore` to load the next page (`offset` + `limit`).",
            parameters: [
                { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: NAIRA_DEPOSITS.HISTORY_MAX_LIMIT, default: NAIRA_DEPOSITS.HISTORY_DEFAULT_LIMIT } },
                { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            ],
            responses: {
                "200": { description: "A page of deposits.", content: jsonContent({ schema: dataEnvelope({ message: "Deposits fetched", code: 200, data: { type: "object", properties: {
                    items: { type: "array", items: nairaDeposit }, limit: { type: "integer", example: 20 }, offset: { type: "integer", example: 0 }, hasMore: { type: "boolean" },
                } } }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/naira-deposits/active": {
        get: {
            tags: ["Naira deposits"], summary: "The deposit in progress", operationId: "getActiveNairaDeposit", security: auth,
            description: "The user's newest deposit whose account can still be paid (`pending`, not past expiry), or `data: null`. Call it on app start / foreground and when opening Add Money to reopen the account card — works after a crash, a reinstall or on another device.",
            responses: {
                "200": { description: "The deposit in progress, or null.", content: jsonContent({ schema: dataEnvelope({ message: "Active deposit fetched", code: 200, data: { ...nairaDeposit, type: ["object", "null"] } }) }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/naira-deposits/{nairaDepositId}": {
        get: {
            tags: ["Naira deposits"], summary: "A naira deposit", operationId: "getNairaDeposit", security: auth,
            description: "The deposit as Doviz has it. Fetch it when a `naira_deposit.updated` socket event names it (and when the socket reconnects). Doesn't call the provider.",
            parameters: [{ name: "nairaDepositId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
                "200": { description: "The deposit.", content: jsonContent({ schema: dataEnvelope({ message: "Deposit fetched", code: 200, data: nairaDeposit }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "404": error("No such deposit for this user.", "Deposit not found", 404),
                "500": ref("ServerError"),
            },
        },
    },
};

export default nairaDepositPaths;
