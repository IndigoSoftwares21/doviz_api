import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";
import { statementItem, statementDetail } from "./walletSchemas";

const auth = [{ BearerAuth: [] }];
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const validationError = (description: string) => ({
    description,
    content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }),
});

const statementPaths = {
    "/wallet/transactions": {
        get: {
            tags: ["Naira wallet"], summary: "My statement", operationId: "getWalletTransactions", security: auth,
            description: "Every movement of the naira balance, newest first, read from the ledger. "
                + "Pass `nextCursor` back as `cursor` for the next page; `null` means the end. "
                + "Filters are optional and combine; keep sending the same ones with each `cursor`. "
                + "`type` covers refunds and fee adjustments of that kind (e.g. `bill` includes refunded bills).",
            parameters: [
                { name: "cursor", in: "query", schema: { type: "string" }, description: "Opaque; from `nextCursor`." },
                { name: "size", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
                { name: "direction", in: "query", schema: { type: "string", enum: ["credit", "debit"] }, description: "Money in or money out." },
                {
                    name: "type", in: "query", schema: { type: "string", enum: ["crypto", "bank_transfer", "withdrawal", "bill"] },
                    description: "What caused the line.",
                },
                {
                    name: "from", in: "query", schema: { type: "string", format: "date-time" },
                    description: "Inclusive. ISO 8601 with offset, e.g. `2026-11-01T00:00:00+01:00`.",
                },
                {
                    name: "to", in: "query", schema: { type: "string", format: "date-time" },
                    description: "Exclusive; must be after `from`. A range is at most 366 days.",
                },
            ],
            responses: {
                "200": {
                    description: "A page of statement lines.",
                    content: jsonContent({ schema: dataEnvelope({ message: "Transactions fetched", code: 200, data: {
                        type: "object",
                        properties: { items: { type: "array", items: statementItem }, nextCursor: { type: ["string", "null"] } },
                    } }) }),
                },
                "400": validationError("Invalid cursor, size or filter."),
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/wallet/transactions/{id}": {
        get: {
            tags: ["Naira wallet"], summary: "One statement line", operationId: "getWalletTransaction", security: auth,
            description: "Full conversion details (rate, markup, tx hash) for a statement line.",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
                "200": {
                    description: "The statement line.",
                    content: jsonContent({ schema: dataEnvelope({ message: "Transaction fetched", code: 200, data: statementDetail }) }),
                },
                "400": validationError("Invalid id, or no such transaction for this user."),
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
};

export default statementPaths;
