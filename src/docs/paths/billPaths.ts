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

**Flow:** categories → billers in a category → a biller's products → (if \`requiresValidation\`) validate the customer number → pay.

- Every id and name here is Doviz's own — the same whichever bill provider is behind it, so the app never changes when the provider does.
- A product's \`amountType\` is \`fixed\` (pay exactly \`price\`, e.g. a data bundle) or \`range\` (any amount from \`minAmount\` to \`maxAmount\`, e.g. airtime or electricity). The user is charged the amount plus \`serviceFee\`.
- Customer numbers: phone numbers here are **local** (\`08038291822\`) — they're the line being topped up, not a login. Spaces and dashes are dropped. Check them against the biller's \`customerIdPattern\` before sending.
- Lists only contain what can be bought right now; they can change between calls, so don't cache them for long.`,
    },
];

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
};

export default billPaths;
