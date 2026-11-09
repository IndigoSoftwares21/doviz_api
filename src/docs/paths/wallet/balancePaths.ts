import jsonContent from "@/docs/utils/jsonContent";
import dataEnvelope from "@/docs/utils/dataEnvelope";
import CRYPTO from "@/constants/crypto";
import { incomingDeposit } from "./walletSchemas";

const auth = [{ BearerAuth: [] }];
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const errors = { "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError") };

const balancePaths = {
    "/wallet/balance": {
        get: {
            tags: ["Naira wallet"], summary: "My naira balance", operationId: "getWalletBalance", security: auth,
            description: "Read from the ledger. `0.00` before the first credit.",
            responses: {
                "200": {
                    description: "Balance.",
                    content: jsonContent({ schema: dataEnvelope({ message: "Balance fetched", code: 200, data: { type: "object", properties: {
                        currency: { type: "string", example: CRYPTO.CURRENCY }, available: { type: "string", example: "156000.00" },
                    } } }) }),
                },
                ...errors,
            },
        },
    },
    "/wallet/incoming": {
        get: {
            tags: ["Naira wallet"], summary: "Incoming deposits", operationId: "getWalletIncoming", security: auth,
            description: "Deposits seen on-chain but not yet credited (confirming, or flagged e.g. below the minimum). "
                + "No money has moved yet; once credited they appear in the statement.",
            responses: {
                "200": {
                    description: "Up to 50 incoming deposits, newest first.",
                    content: jsonContent({ schema: dataEnvelope({ message: "Incoming deposits fetched", code: 200, data: {
                        type: "array", items: incomingDeposit,
                    } }) }),
                },
                ...errors,
            },
        },
    },
};

export default balancePaths;
