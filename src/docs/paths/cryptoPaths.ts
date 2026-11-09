import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";

const auth = [{ BearerAuth: [] }];
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const money = { type: "string", example: "156000.00", description: "Naira, exact decimal string" };
const asset = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        symbol: { type: "string", example: "USDT" },
        network: { type: "string", example: "TRC20" },
        name: { type: "string", example: "Tether" },
        minDeposit: { type: ["string", "null"], example: "5" },
        confirmations: { type: ["integer", "null"], example: 19 },
    },
};
const wallet = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        assetId: { type: "string", format: "uuid" },
        symbol: { type: "string", example: "USDT" },
        network: { type: "string", example: "TRC20" },
        address: { type: "string", example: "TV8dNYYBgL3xLbQcJLMBNavY4gYNqPF8Jv" },
        isPrimary: { type: "boolean" },
        status: { type: "string", enum: ["active", "retired"] },
        createdAt: { type: "string", format: "date-time" },
    },
};

const cryptoPaths = {
    "/crypto/assets": {
        get: {
            tags: ["Crypto deposits"], summary: "List depositable coins", operationId: "getCryptoAssets", security: auth,
            responses: {
                "200": { description: "Coins.", content: jsonContent({ schema: dataEnvelope({ message: "Assets fetched", code: 200, data: { type: "array", items: asset } }) }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/crypto/quote": {
        get: {
            tags: ["Crypto deposits"], summary: "Estimate naira for a deposit", operationId: "getCryptoQuote", security: auth,
            description: "Provider conversion (after its fee) minus Doviz's markup for the coin. An estimate, cached briefly; the final amount uses the rate at completion. 503 when no markup is configured for the coin.",
            parameters: [
                { name: "assetId", in: "query", required: true, schema: { type: "string", format: "uuid" } },
                { name: "cryptoAmount", in: "query", required: true, schema: { type: "string", example: "100" } },
            ],
            responses: {
                "200": {
                    description: "Estimate.",
                    content: jsonContent({ schema: dataEnvelope({ message: "Quote fetched", code: 200, data: { type: "object", properties: {
                        assetId: { type: "string", format: "uuid" }, cryptoAmount: { type: "string", example: "100" },
                        grossNgn: money, markupPercent: { type: "string", example: "2.500" }, markupNgn: money, netNgn: money,
                        rateNgnPerUsd: { type: "string", example: "1600" }, expiresAt: { type: "string", format: "date-time" }, isEstimate: { type: "boolean", example: true },
                    } } }) }),
                },
                "400": { description: "Invalid coin or amount.", content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "503": { description: "Conversions unavailable (no markup configured).", content: jsonContent({ schema: { $ref: "#/components/schemas/Error" } }) },
                "500": ref("ServerError"),
            },
        },
    },
    "/crypto/wallets": {
        post: {
            tags: ["Crypto deposits"], summary: "Get or create my deposit address", operationId: "postCryptoWallet", security: auth,
            description: "Returns the user's primary address for the coin, creating it if needed. Safe to retry: never creates a second address. Requires a legal name and a transfer PIN.",
            requestBody: { required: true, content: jsonContent({ schema: { type: "object", required: ["assetId"], properties: { assetId: { type: "string", format: "uuid" } } } }) },
            responses: {
                "200": { description: "Address.", content: jsonContent({ schema: dataEnvelope({ message: "Deposit address ready", code: 200, data: wallet }) }) },
                "400": { description: "Coin unavailable or onboarding incomplete.", content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "503": { description: "Provider couldn't issue the address right now — retry.", content: jsonContent({ schema: { $ref: "#/components/schemas/Error" } }) },
                "500": ref("ServerError"),
            },
        },
        get: {
            tags: ["Crypto deposits"], summary: "List my deposit addresses", operationId: "getCryptoWallets", security: auth,
            description: "Active and retired addresses. Show only the primary one per coin for receiving.",
            responses: {
                "200": { description: "Addresses.", content: jsonContent({ schema: dataEnvelope({ message: "Deposit addresses fetched", code: 200, data: { type: "array", items: { allOf: [wallet, { type: "object", properties: { isRetired: { type: "boolean" }, retiredAt: { type: ["string", "null"], format: "date-time" } } }] } } }) }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
};

export default cryptoPaths;
