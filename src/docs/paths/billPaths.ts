import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";
import { BILL_CATEGORY } from "@/constants/bills";

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
const categoryCode = { type: "string", enum: Object.values(BILL_CATEGORY), example: "electricity" };

export const billTags = [
    {
        name: "Bills",
        description: `Airtime, data, electricity, cable TV and internet, paid from the user's naira balance.

**Flow:** categories → billers in a category → a biller's products → (if \`requiresValidation\`) validate the customer number → pay → show "Payment sent" and listen for the result on the socket.

**Paying:** \`POST /bills/payments\` takes the money from the user's naira balance at once and sends the payment to the biller. It comes back \`pending\` — show "Payment sent" straight away; the result arrives as a socket event (below):
- \`completed\` — delivered. For prepaid electricity, show \`token\`.
- \`failed\` — not delivered; the full \`total\` has already been returned to the balance. Show \`failureReason\`.
- \`processing\` — the biller hasn't answered yet (it can take minutes). Money is never refunded on a guess.

**Realtime (Socket.IO):** connect to path \`/api/v1/realtime\` with \`auth: { token: <accessToken> }\`. The server closes the socket when the token expires — reconnect after unlocking, then refetch anything on screen. Events (to all of the user's devices):
- \`bill_payment.updated\` \`{ billPaymentId, status }\` — a payment completed or failed (refunded): fetch \`GET /bills/payments/{id}\` for details and the token.
- \`wallet.balance_changed\` \`{}\` — the naira balance changed (payment, refund, deposit): refetch the balance.

Send a new UUID \`idempotencyKey\` for each payment and **reuse it when retrying** after a timeout or network error — the retry returns the original payment instead of paying twice.

- Every id and name here is Ziks's own — the same whichever bill provider is behind it, so the app never changes when the provider does.
- A product's \`amountType\` is \`fixed\` (pay exactly \`price\`, e.g. a data bundle) or \`range\` (any amount from \`minAmount\` to \`maxAmount\`, e.g. airtime or electricity). The user is charged the amount plus \`serviceFee\`.
- Customer numbers: phone numbers here are **local** (\`08038291822\`) — they're the line being topped up, not a login. Spaces and dashes are dropped. Check them against the biller's \`customerIdPattern\` before sending.
- Lists only contain what can be bought right now; they can change between calls, so don't cache them for long.`,
    },
];

const billPayment = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
        biller: { type: "object", properties: {
            id: { type: "string", format: "uuid" }, name: { type: "string", example: "Ikeja Electric (IKEDC)" }, category: categoryCode,
            logoUrl: { type: ["string", "null"], format: "uri" },
        } },
        product: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string", example: "Prepaid" } } },
        customerId: { type: "string", example: "45067198783" },
        customerName: { type: ["string", "null"], example: null },
        currency: { type: "string", example: "NGN" },
        amount: money("5000.00", "Paid to the biller."),
        serviceFee: money("0.00"),
        total: money("5000.00", "Taken from the balance (amount + serviceFee)."),
        token: { type: ["string", "null"], example: "1234-5678-9012-3456-7890", description: "Prepaid electricity token / PIN. Only once completed." },
        failureReason: { type: ["string", "null"], example: null, description: "Shown to the user when failed." },
        createdAt: { type: "string", format: "date-time" },
        completedAt: { type: ["string", "null"], format: "date-time", description: "When it became completed or failed." },
    },
};

const billPaths = {
    "/bills/categories": {
        get: {
            tags: ["Bills"], summary: "List bill categories", operationId: "getBillCategories", security: auth,
            description: "Only categories with at least one biller available right now.",
            responses: {
                "200": { description: "Categories, in display order.", content: jsonContent({ schema: dataEnvelope({ message: "Bill categories fetched", code: 200, data: { type: "array", items: { type: "object", properties: {
                    code: categoryCode, name: { type: "string", example: "Electricity" },
                } } } }) }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/bills/billers": {
        get: {
            tags: ["Bills"], summary: "List billers", operationId: "getBillers", security: auth,
            description: "Billers available right now, in display order. Pass `category` for one category.",
            parameters: [{ name: "category", in: "query", required: false, schema: categoryCode }],
            responses: {
                "200": { description: "Billers.", content: jsonContent({ schema: dataEnvelope({ message: "Billers fetched", code: 200, data: { type: "array", items: { type: "object", properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string", example: "Ikeja Electric (IKEDC)" },
                    category: categoryCode,
                    logoUrl: { type: ["string", "null"], format: "uri", description: "null until a logo is uploaded — show a category icon." },
                    customerIdLabel: { type: "string", example: "Meter number", description: "Label for the customer number field." },
                    customerIdPattern: { type: ["string", "null"], example: "^[0-9]{6,20}$", description: "Regex the customer number must match; null = any letters/digits." },
                    requiresValidation: { type: "boolean", example: true, description: "When true, call POST /bills/validate and show the name before paying." },
                } } } }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/bills/billers/{billerId}/products": {
        get: {
            tags: ["Bills"], summary: "List a biller's products", operationId: "getBillProducts", security: auth,
            description: "Any-amount products first, then by price.",
            parameters: [{ name: "billerId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
                "200": { description: "Products.", content: jsonContent({
                    schema: dataEnvelope({ message: "Bill products fetched", code: 200, data: { type: "array", items: { type: "object", properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string", example: "1.5GB" },
                        amountType: { type: "string", enum: ["fixed", "range"] },
                        currency: { type: "string", example: "NGN" },
                        price: money("1000.00", "Set for fixed products; null for range."),
                        minAmount: money(null, "Set for range products; null for fixed."),
                        maxAmount: money(null, "Set for range products; null for fixed."),
                        serviceFee: money("0.00", "Added on top of the amount."),
                        validityDays: { type: ["integer", "null"], example: 30, description: "How long a bundle or plan lasts, when known." },
                        validityGroup: { type: "string", enum: ["daily", "weekly", "monthly", "quarterly", "long_term", "other"], example: "monthly", description: "For tabbing plans: daily 1–2 days, weekly 3–14, monthly 15–45, quarterly 46–120, long_term over 120, other when unknown." },
                    } } } }),
                    example: { message: "Bill products fetched", code: 200, data: [
                        { id: "3f1c2a52-6a0e-4f5b-9a57-2f5f1d0c9b10", name: "Prepaid", amountType: "range", currency: "NGN", price: null, minAmount: "500.00", maxAmount: "500000.00", serviceFee: "0.00", validityDays: null },
                        { id: "8b2d4c61-1f3e-4a7b-8c9d-0e1f2a3b4c5d", name: "Postpaid", amountType: "range", currency: "NGN", price: null, minAmount: "500.00", maxAmount: "500000.00", serviceFee: "0.00", validityDays: null },
                    ] },
                }) },
                "400": { description: "Invalid biller id, or the biller isn't available.", content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/bills/networks/detect": {
        get: {
            tags: ["Bills"], summary: "Detect a phone number's network", operationId: "getBillNetwork", security: auth,
            description: "Guesses the mobile network from the number's prefix and returns our airtime and data billers for it, so the app can pre-select the network as the user types. **Only a default** — numbers moved to another network keep their old prefix, so always let the user change it. `network` is null for prefixes we don't recognise; a biller id is null when that network can't be paid right now.",
            parameters: [{ name: "phone", in: "query", required: true, schema: { type: "string", example: "08126257120" }, description: "Any common format: 08126257120, +2348126257120, 8126257120." }],
            responses: {
                "200": { description: "Detected (or not).", content: jsonContent({
                    schema: dataEnvelope({ message: "Network detected", code: 200, data: { type: "object", properties: {
                        phone: { type: "string", example: "08126257120", description: "Normalised local form — send this as customerId." },
                        network: { type: ["object", "null"], properties: { code: { type: "string", enum: ["mtn", "airtel", "glo", "9mobile"] }, name: { type: "string", example: "Airtel" } } },
                        airtimeBillerId: { type: ["string", "null"], format: "uuid" },
                        dataBillerId: { type: ["string", "null"], format: "uuid" },
                    } } }),
                }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/bills/validate": {
        post: {
            tags: ["Bills"], summary: "Check a customer number", operationId: "postBillCustomerValidation", security: auth,
            description: "Looks up the meter, smartcard or account number and returns the name on it, to show the user before they pay. For billers with `requiresValidation: false` (airtime, data) it answers at once with nulls. Rate-limited per IP.",
            requestBody: { required: true, content: jsonContent({
                schema: { type: "object", required: ["productId", "customerId"], properties: {
                    productId: { type: "string", format: "uuid" },
                    customerId: { type: "string", example: "45067198783", description: "Meter / smartcard / account / phone number. Spaces and dashes are dropped." },
                } },
            }) },
            responses: {
                "200": { description: "Customer found.", content: jsonContent({ schema: dataEnvelope({ message: "Customer found", code: 200, data: { type: "object", properties: {
                    customerName: { type: ["string", "null"], example: "ADEBAYO OLUWASEUN" },
                    address: { type: ["string", "null"], example: "12 Allen Avenue, Ikeja" },
                    minAmount: money("1000.00", "This customer's minimum, when the biller sets one (overrides the product's)."),
                    maxAmount: money("500000.00", "This customer's maximum, when the biller sets one."),
                } } }) }) },
                "400": error("Validation failed, or the biller has no such customer.", "We couldn't find this customer number. Check it and try again.", 400),
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "429": ref("TooManyRequests"), "500": ref("ServerError"),
                "503": error("The bill provider can't be reached right now. Try again shortly.", "Bill payments are temporarily unavailable. Please try again shortly.", 503),
            },
        },
    },
    "/bills/payments": {
        post: {
            tags: ["Bills"], summary: "Pay a bill", operationId: "postBillPayment", security: auth,
            description: "Requires the transfer PIN. For billers with `requiresValidation` (meters, smartcards) the server checks the number with the biller first — an unknown number, or an amount outside that customer's own limits, is refused before any money moves. Then it takes `total` from the naira balance and submits the payment. Returns `201` for a new payment, or `200` with the original payment when the `idempotencyKey` was already used.",
            requestBody: { required: true, content: jsonContent({
                schema: { type: "object", required: ["productId", "customerId", "idempotencyKey", "pin"], properties: {
                    productId: { type: "string", format: "uuid" },
                    customerId: { type: "string", example: "08038291822", description: "Phone / meter / smartcard / account number. Spaces and dashes are dropped." },
                    amount: { type: "string", example: "1500.00", description: "Required for `range` products (between minAmount and maxAmount). Optional for `fixed` products — if sent, it must equal the price." },
                    idempotencyKey: { type: "string", format: "uuid", description: "New per payment; reuse it only to retry the same payment." },
                    pin: { $ref: "#/components/schemas/Pin" },
                } },
                example: { productId: "3f1c2a52-6a0e-4f5b-9a57-2f5f1d0c9b10", customerId: "08038291822", amount: "1500.00", idempotencyKey: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", pin: "4827" },
            }) },
            responses: {
                "201": { description: "Submitted (usually `pending`).", content: jsonContent({ schema: dataEnvelope({ message: "Bill payment submitted", code: 201, data: billPayment }) }) },
                "200": { description: "This idempotencyKey was already used — the original payment.", content: jsonContent({ schema: dataEnvelope({ message: "Bill payment already submitted", code: 200, data: billPayment }) }) },
                "400": error("Validation failed (amount out of range, invalid customer number, unavailable product), the biller has no such customer, the amount is outside this customer's limits, or wrong PIN.", "For this customer the amount must be at least ₦1,500.00", 400),
                "401": ref("Unauthorized"),
                "402": error("The balance doesn't cover `total`.", "You don't have enough balance for this payment", 402),
                "403": ref("Forbidden"), "423": ref("PinLocked"), "500": ref("ServerError"),
                "503": error("The biller can't check the customer right now; nothing was charged.", "Bill payments are temporarily unavailable. Please try again shortly.", 503),
            },
        },
        get: {
            tags: ["Bills"], summary: "My bill payments", operationId: "getBillPayments", security: auth,
            description: "Newest first. Use `hasMore` to load the next page (`offset` + `limit`).",
            parameters: [
                { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
                { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            ],
            responses: {
                "200": { description: "A page of payments.", content: jsonContent({ schema: dataEnvelope({ message: "Bill payments fetched", code: 200, data: { type: "object", properties: {
                    items: { type: "array", items: billPayment }, limit: { type: "integer", example: 20 }, offset: { type: "integer", example: 0 }, hasMore: { type: "boolean" },
                } } }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/bills/payments/{billPaymentId}": {
        get: {
            tags: ["Bills"], summary: "A bill payment", operationId: "getBillPayment", security: auth,
            description: "The payment as Ziks has it. Fetch it when a `bill_payment.updated` socket event names it (and when the socket reconnects). Doesn't call the biller.",
            parameters: [{ name: "billPaymentId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
                "200": { description: "The payment.", content: jsonContent({ schema: dataEnvelope({ message: "Bill payment fetched", code: 200, data: billPayment }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "404": error("No such payment for this user.", "Bill payment not found", 404),
                "500": ref("ServerError"),
            },
        },
    },
};

export default billPaths;
