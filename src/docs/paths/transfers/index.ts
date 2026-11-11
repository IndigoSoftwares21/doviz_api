import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";
import { transfer, transferLimits, transferRecipient } from "./transferSchemas";

const auth = [{ BearerAuth: [] }];
const tags = ["Transfers"];
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const error = (description: string, message: string, code: number) => ({ description, content: jsonContent({ schema: { $ref: "#/components/schemas/Error" }, example: { message, code } }) });
const ok = (description: string, message: string, data: object, code = 200) => ({ description, content: jsonContent({ schema: dataEnvelope({ message, code, data }) }) });
const invalid = (description: string) => ({ description, content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }) });
const notFound = error("No Ziks user can be paid with that Ziktag. The same answer for every reason (no such tag, inactive, yourself), so lookups reveal nothing.", "No Ziks user with that Ziktag", 404);
const common = { "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError") };

const transferPaths = {
    "/transfers/limits": {
        get: {
            tags, summary: "My sending limits", operationId: "getTransferLimits", security: auth,
            description: "Read fresh for the amount screen: a limit changed by ops applies to the very next transfer.",
            responses: { "200": ok("Limits and what's left today.", "Transfer limits fetched", transferLimits), ...common },
        },
    },
    "/transfers/recipients": {
        get: {
            tags, summary: "Find someone by Ziktag", operationId: "getTransferRecipient", security: auth,
            description: "Exact match only (\"@Ada\" and \"ada\" are the same). No search or partial matches. Limited to 30 lookups per 10 minutes per user.",
            parameters: [{ name: "tag", in: "query", required: true, schema: { type: "string", example: "@ada" } }],
            responses: { "200": ok("Who you'd be paying.", "Recipient found", transferRecipient), "400": invalid("Not a valid Ziktag."), "404": notFound, "429": ref("TooManyRequests"), ...common },
        },
    },
    "/transfers/recipients/recent": {
        get: {
            tags, summary: "People I recently paid", operationId: "getRecentRecipients", security: auth,
            description: "Up to 10, newest first, for one-tap repeat sends. People who can no longer be paid are left out.",
            responses: { "200": ok("Recent recipients.", "Recent recipients fetched", { type: "object", properties: { recipients: { type: "array", items: transferRecipient } } }), ...common },
        },
    },
    "/transfers": {
        post: {
            tags, summary: "Send money to a Ziks user", operationId: "postTransfer", security: auth,
            description: `Instant and free. Requires the transfer PIN. Completed when this returns — there's no pending state.

- \`recipientId\` comes from the lookup. If they can no longer be paid: **404**.
- Limits (minimum, per transfer, rolling 24 hours) fail as a validation error on \`amount\`, e.g. "You can send up to ₦640,000 more today".
- Send a new UUID \`idempotencyKey\` per transfer and reuse it to retry: a retry returns the original (200), never a second send.
- Both balances change at once; the recipient gets \`transfer.received\` { transferId, amount, senderTag } and both get \`wallet.balance_changed\`.`,
            requestBody: { required: true, content: jsonContent({ schema: { type: "object", required: ["recipientId", "amount", "idempotencyKey", "pin"], properties: {
                recipientId: { type: "string", format: "uuid" }, amount: { type: "string", example: "5000.00" },
                note: { type: "string", maxLength: 100, example: "for lunch", description: "Optional; shown to both people." },
                idempotencyKey: { type: "string", format: "uuid" }, pin: { $ref: "#/components/schemas/Pin" },
            } } }) },
            responses: {
                "201": ok("Sent.", "Money sent", transfer, 201),
                "200": ok("This idempotencyKey was already used — the original transfer.", "Money already sent", transfer),
                "400": invalid("Validation failed (including a limit, on `amount`), sending to yourself, or a wrong PIN."),
                "402": error("The balance doesn't cover the amount; nothing moved.", "You don't have enough in your balance for this transfer.", 402),
                "404": notFound, "423": ref("PinLocked"), ...common,
            },
        },
    },
    "/transfers/{transferId}": {
        get: {
            tags, summary: "A transfer", operationId: "getTransfer", security: auth,
            description: "Only to its sender or recipient; `direction` and `counterparty` are from the viewer's side. Fetch it when `transfer.received` names it.",
            parameters: [{ name: "transferId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            responses: { "200": ok("The transfer.", "Transfer fetched", transfer), "400": invalid("Invalid id."), "404": error("Not yours, or no such transfer.", "Transfer not found", 404), ...common },
        },
    },
};

export default transferPaths;
