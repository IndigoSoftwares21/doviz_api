import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";
import { buyAssetListItem, buyQuote, cryptoPurchase } from "./cryptoBuySchemas";

const auth = [{ BearerAuth: [] }];
const tags = ["Buy crypto"];
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const error = (description: string, message: string, code: number) => ({ description, content: jsonContent({ schema: { $ref: "#/components/schemas/Error" }, example: { message, code } }) });
const ok = (description: string, message: string, data: object, code = 200) => ({ description, content: jsonContent({ schema: dataEnvelope({ message, code, data }) }) });
const unavailable = error("Buying is paused (partner unavailable, low stock, or prices being updated); nothing was taken.", "Buying crypto is unavailable right now. Please try again shortly.", 503);
const amountInputs = [
    { name: "assetId", in: "query", required: true, schema: { type: "string", format: "uuid" } },
    { name: "cryptoAmount", in: "query", required: false, schema: { type: "string", example: "10" }, description: "The coin to receive — or:" },
    { name: "nairaTotal", in: "query", required: false, schema: { type: "string", example: "20000.00" }, description: "The naira to spend in total (exactly one of the two)." },
];

const cryptoBuyPaths = {
    "/crypto/buy/assets": {
        get: {
            tags, summary: "Coins I can buy", operationId: "getCryptoBuyAssets", security: auth,
            responses: { "200": ok("Buyable coins and networks.", "Coins you can buy", { type: "array", items: buyAssetListItem }), "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError") },
        },
    },
    "/crypto/buy/quote": {
        get: {
            tags, summary: "Price a purchase", operationId: "getCryptoBuyQuote", security: auth, parameters: amountInputs,
            description: "What buying costs right now. The network fee is priced in, so `cryptoAmount` arrives exactly. Show `total` on the confirm screen and send it back as `expectedTotal`.\n\nAn amount outside the limits still returns **200** with the conversion, but `canBuy: false` and `limitMessage` (e.g. \"The minimum is ₦15,180.00.\"): show the conversion and the message, and disable Buy. The minimum is the provider's smallest send for this coin, priced at our rate (or ₦1,000 if higher).",
            responses: {
                "200": ok("The quote.", "Crypto quote", buyQuote),
                "400": error("Validation failed, the coin isn't buyable now, or the amount is too small to buy any coin.", "The minimum is ₦15,180.00.", 400),
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"), "503": unavailable,
            },
        },
    },
    "/crypto/buy": {
        post: {
            tags, summary: "Buy crypto", operationId: "postCryptoPurchase", security: auth,
            description: `Buys a coin with naira and sends it to the user's own wallet address. Requires the transfer PIN.

- \`expectedTotal\` is the quote's \`total\` and \`expectedCryptoAmount\` its \`cryptoAmount\`. Prices of coins like ETH move between the quote and the PIN, so the server re-prices: it goes ahead at the fresh price when the user pays **no more** than \`expectedTotal\` and gets **no more than 0.5% less** coin than \`expectedCryptoAmount\` (the same or more is always fine). Otherwise nothing is taken: **409** — show the new quote and confirm again. Without \`expectedCryptoAmount\` (older apps) the total must match exactly.
- \`total\` leaves the balance at once; the result arrives on the socket (\`crypto_purchase.updated\`). Show "Sending…" straight away.
- \`failed\` means the full total is back in the balance. An unclear outcome is never refunded on a guess (crypto can't be pulled back): it becomes \`needs_review\`.
- Send a new UUID \`idempotencyKey\` per purchase and reuse it to retry — a retry returns the original (200), never a second send.`,
            requestBody: { required: true, content: jsonContent({ schema: { type: "object", required: ["assetId", "address", "expectedTotal", "idempotencyKey", "pin"], properties: {
                assetId: { type: "string", format: "uuid" }, cryptoAmount: { type: "string", example: "10" }, nairaTotal: { type: "string", example: "20000.00" },
                address: { type: "string", example: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" }, memo: { type: "string" },
                expectedTotal: { type: "string", example: "18150.00" }, expectedCryptoAmount: { type: "string", example: "0.01780000", description: "The quote's cryptoAmount (recommended)." }, idempotencyKey: { type: "string", format: "uuid" }, pin: { $ref: "#/components/schemas/Pin" },
            } } }) },
            responses: {
                "201": ok("Sent (usually `pending`).", "Crypto purchase sent", cryptoPurchase, 201),
                "200": ok("This idempotencyKey was already used — the original purchase.", "Crypto purchase already sent", cryptoPurchase),
                "400": error("Validation failed, wrong PIN, invalid address for the network, or amount outside the limits.", "That address isn't valid for this network. Check it — crypto sent to a wrong address can't be recovered.", 400),
                "401": ref("Unauthorized"),
                "402": error("The balance doesn't cover the total.", "You don't have enough naira for this purchase.", 402),
                "403": ref("Forbidden"),
                "409": error("The price moved against the user since the quote (more naira, or over 0.5% less coin); nothing was taken.", "The price changed. Please check the new total and confirm again.", 409),
                "423": ref("PinLocked"), "500": ref("ServerError"), "503": unavailable,
            },
        },
    },
    "/crypto/buy/{purchaseId}": {
        get: {
            tags, summary: "A crypto purchase", operationId: "getCryptoPurchase", security: auth,
            description: "Fetch it when a `crypto_purchase.updated` socket event names it (and when the socket reconnects).",
            parameters: [{ name: "purchaseId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
                "200": ok("The purchase.", "Crypto purchase fetched", cryptoPurchase),
                "400": { description: "Validation failed.", content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "404": error("No such purchase for this user.", "Purchase not found", 404), "500": ref("ServerError"),
            },
        },
    },
};

export default cryptoBuyPaths;
