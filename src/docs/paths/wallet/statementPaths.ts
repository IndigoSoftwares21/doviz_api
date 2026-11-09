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
                + "Pass `nextCursor` back as `cursor` for the next page; `null` means the end.",
            parameters: [
                { name: "cursor", in: "query", schema: { type: "string" }, description: "Opaque; from `nextCursor`." },
                { name: "size", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
            ],
            responses: {
                "200": {
                    description: "A page of statement lines.",
                    content: jsonContent({ schema: dataEnvelope({ message: "Transactions fetched", code: 200, data: {
                        type: "object",
                        properties: { items: { type: "array", items: statementItem }, nextCursor: { type: ["string", "null"] } },
                    } }) }),
                },
                "400": validationError("Invalid cursor or size."),
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
