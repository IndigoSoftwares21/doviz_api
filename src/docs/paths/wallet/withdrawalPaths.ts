import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";

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
const bankAccount = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        bankName: { type: "string", example: "GTBank" },
        accountNumber: { type: "string", example: "******6789", description: "Always masked" },
        accountName: { type: "string", example: "OKAFOR ADAEZE" },
    },
};
const withdrawal = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
        bankAccount,
        currency: { type: "string", example: "NGN" },
        amount: money("5000.00", "Sent to the bank."),
        fee: money(null, "The real transfer fee, once completed."),
        feeReserve: money("15.31", "Held to cover the fee; any unused part comes back at completion."),
        totalHeld: money("5015.31", "Taken from the balance when sent (amount + fee reserve)."),
        failureReason: { type: ["string", "null"], example: null, description: "Shown to the user when failed (the money is already back)." },
        createdAt: { type: "string", format: "date-time" },
        completedAt: { type: ["string", "null"], format: "date-time" },
    },
};

const withdrawalPaths = {
    "/wallet/withdrawals/quote": {
        get: {
            tags: ["Naira wallet"], summary: "Price a withdrawal", operationId: "getWithdrawalQuote", security: auth,
            description: "What sending `amount` to one of the user's own bank accounts costs right now. The fee is the payout partner's own and is paid by the user: `feeIsExact: true` means that's the fee; `false` means it's a reserve (the highest recent real fee) — the real fee is charged on completion and any unused part returned. Show `totalHeld` on the confirm screen and send it back as `expectedTotal`.",
            parameters: [
                { name: "bankAccountId", in: "query", required: true, schema: { type: "string", format: "uuid" }, description: "One of the user's linked accounts (GET /user/bank-accounts)." },
                { name: "amount", in: "query", required: true, schema: { type: "string", example: "5000.00" }, description: "₦100.00 – ₦5,000,000.00" },
            ],
            responses: {
                "200": { description: "The quote.", content: jsonContent({ schema: dataEnvelope({ message: "Withdrawal quote", code: 200, data: { type: "object", properties: {
                    bankAccount, currency: { type: "string", example: "NGN" }, amount: money("5000.00"), fee: money("15.31"),
                    feeIsExact: { type: "boolean", example: false }, totalHeld: money("5015.31"),
                } } }) }) },
                "400": error("Validation failed, not the user's own account, or withdrawals to this bank are unavailable right now.", "Withdrawals to this bank are unavailable right now. Try another of your accounts.", 400),
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/wallet/withdrawals": {
        post: {
            tags: ["Naira wallet"], summary: "Send money to my bank", operationId: "postWithdrawal", security: auth,
            description: `Sends naira to one of the user's **own** linked bank accounts (name-matched). Requires the transfer PIN.

- \`expectedTotal\` is the \`totalHeld\` the user confirmed. If the fee or payout partner changed since, nothing is taken: **409** — fetch a new quote and confirm again.
- \`totalHeld\` leaves the balance at once; the result arrives on the socket (\`withdrawal.updated\`, \`wallet.balance_changed\`). Show "Withdrawal sent" straight away.
- \`failed\` means the full \`totalHeld\` is back in the balance. Money is never refunded on a guess.
- Send a new UUID \`idempotencyKey\` per withdrawal and reuse it to retry — a retry returns the original (200), never a second payout.`,
            requestBody: { required: true, content: jsonContent({
                schema: { type: "object", required: ["bankAccountId", "amount", "expectedTotal", "idempotencyKey", "pin"], properties: {
                    bankAccountId: { type: "string", format: "uuid" }, amount: { type: "string", example: "5000.00" },
                    expectedTotal: { type: "string", example: "5015.31" }, idempotencyKey: { type: "string", format: "uuid" },
                    pin: { $ref: "#/components/schemas/Pin" },
                } },
            }) },
            responses: {
                "201": { description: "Sent (usually `pending`).", content: jsonContent({ schema: dataEnvelope({ message: "Withdrawal sent", code: 201, data: withdrawal }) }) },
                "200": { description: "This idempotencyKey was already used — the original withdrawal.", content: jsonContent({ schema: dataEnvelope({ message: "Withdrawal already sent", code: 200, data: withdrawal }) }) },
                "400": error("Validation failed, wrong PIN, not the user's own account, or this bank is unavailable.", "Choose one of your bank accounts", 400),
                "401": ref("Unauthorized"),
                "402": error("The balance doesn't cover the amount and fee.", "You don't have enough balance for this withdrawal and its fee", 402),
                "403": ref("Forbidden"),
                "409": error("The fee or payout partner changed since the quote; nothing was taken.", "The transfer fee changed. Please check the new total and confirm again.", 409),
                "423": ref("PinLocked"), "500": ref("ServerError"),
                "503": error("Withdrawals can't be made right now; nothing was taken.", "Withdrawals are temporarily unavailable. Please try again shortly.", 503),
            },
        },
    },
    "/wallet/withdrawals/{withdrawalId}": {
        get: {
            tags: ["Naira wallet"], summary: "A withdrawal", operationId: "getWithdrawal", security: auth,
            description: "Fetch it when a `withdrawal.updated` socket event names it (and when the socket reconnects).",
            parameters: [{ name: "withdrawalId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
                "200": { description: "The withdrawal.", content: jsonContent({ schema: dataEnvelope({ message: "Withdrawal fetched", code: 200, data: withdrawal }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "404": error("No such withdrawal for this user.", "Withdrawal not found", 404),
                "500": ref("ServerError"),
            },
        },
    },
};

export default withdrawalPaths;
