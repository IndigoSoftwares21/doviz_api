import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";

const auth = [{ BearerAuth: [] }];
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const error = (description: string) => ({ description, content: jsonContent({ schema: { $ref: "#/components/schemas/Error" } }) });
const validation = { description: "Validation failed.", content: jsonContent({ schema: { $ref: "#/components/schemas/ValidationError" } }) };
const lookupBody = {
    bankId: { type: "string", format: "uuid" },
    accountNumber: { type: "string", pattern: "^[0-9]{10}$", example: "0123456789" },
};
const bankAccount = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" }, bankId: { type: "string", format: "uuid" }, bankName: { type: "string", example: "GTBank" },
        accountNumber: { type: "string", example: "******6789", description: "Always masked" },
        accountName: { type: "string", example: "OKAFOR ADAEZE" }, isPrimary: { type: "boolean" }, verifiedAt: { type: "string", format: "date-time" },
    },
};

const bankPaths = {
    "/banks": {
        get: {
            tags: ["Banks"], summary: "List banks", operationId: "getBanks", security: auth,
            responses: {
                "200": { description: "Banks.", content: jsonContent({ schema: dataEnvelope({ message: "Banks fetched", code: 200, data: { type: "array", items: { type: "object", properties: {
                    id: { type: "string", format: "uuid" }, name: { type: "string", example: "GTBank" }, code: { type: ["string", "null"], example: "058", description: "CBN code; null when not known." },
                } } } }) }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
    },
    "/banks/resolve": {
        post: {
            tags: ["Banks"], summary: "Look up an account name", operationId: "postBankResolution", security: auth,
            description: "Returns the bank's name for the account and whether it matches the user's legal name (first and last, any order). Rate-limited per IP.",
            requestBody: { required: true, content: jsonContent({ schema: { type: "object", required: ["bankId", "accountNumber"], properties: lookupBody } }) },
            responses: {
                "200": { description: "Account found.", content: jsonContent({ schema: dataEnvelope({ message: "Account found", code: 200, data: { type: "object", properties: {
                    accountName: { type: "string", example: "OKAFOR ADAEZE" }, nameMatches: { type: "boolean" },
                } } }) }) },
                "400": validation, "401": ref("Unauthorized"), "403": ref("Forbidden"), "429": ref("TooManyRequests"), "500": ref("ServerError"),
            },
        },
    },
    "/user/bank-accounts": {
        get: {
            tags: ["Banks"], summary: "My bank accounts", operationId: "getBankAccounts", security: auth,
            responses: {
                "200": { description: "Accounts.", content: jsonContent({ schema: dataEnvelope({ message: "Bank accounts fetched", code: 200, data: { type: "array", items: bankAccount } }) }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError"),
            },
        },
        post: {
            tags: ["Banks"], summary: "Add a bank account", operationId: "postBankAccount", security: auth,
            description: "Requires the transfer PIN. The bank's account name must match the user's legal name. The first account becomes primary.",
            requestBody: { required: true, content: jsonContent({ schema: { type: "object", required: ["bankId", "accountNumber", "pin"], properties: { ...lookupBody, pin: { $ref: "#/components/schemas/Pin" } } } }) },
            responses: {
                "201": { description: "Added.", content: jsonContent({ schema: dataEnvelope({ message: "Bank account added", code: 201, data: bankAccount }) }) },
                "400": error("Validation failed, wrong PIN, lookup failed, or the account isn't in the user's name."),
                "401": ref("Unauthorized"), "403": ref("Forbidden"), "423": ref("PinLocked"), "429": ref("TooManyRequests"), "500": ref("ServerError"),
            },
        },
    },
};

export default bankPaths;
