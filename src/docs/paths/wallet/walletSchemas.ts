import { statementTransfer } from "@/docs/paths/transfers/transferSchemas";
import { LEDGER_TRANSACTION_TYPE, ENTRY_DIRECTION } from "@/constants/ledger";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";
import { BILL_CATEGORY } from "@/constants/bills";

const money = (example: string) => ({ type: "string", example });
const nullableMoney = { type: ["string", "null"], example: "1560.00" };
const dateTime = { type: "string", format: "date-time" };

const depositSummary = {
    id: { type: "string", format: "uuid" },
    symbol: { type: ["string", "null"], example: "USDT" },
    network: { type: ["string", "null"], example: "TRC20" },
    cryptoAmount: { type: ["string", "null"], example: "100" },
    grossNgn: { type: ["string", "null"], example: "157560.00" },
    markupNgn: nullableMoney,
    markupPercent: { type: ["string", "null"], example: "1.00" },
};

const statementLine = (deposit: Record<string, unknown>) => ({
    type: "object",
    properties: {
        id: { type: "string", format: "uuid", description: "Ledger entry id; use it for the detail endpoint." },
        type: { type: "string", enum: Object.values(LEDGER_TRANSACTION_TYPE) },
        direction: { type: "string", enum: Object.values(ENTRY_DIRECTION) },
        amount: { ...money("156000.00"), description: "Always positive; see `direction`." },
        balanceAfter: money("156000.00"),
        description: { type: "string", example: "100 USDT converted to naira", description: "Bills say their kind, e.g. \"Airtime purchase\"." },
        createdAt: dateTime,
        deposit: { type: ["object", "null"], properties: deposit, description: "Set for crypto conversions." },
        transfer: statementTransfer,
        bill: {
            type: ["object", "null"],
            description: "Set for bill payments and their refunds.",
            properties: {
                id: { type: "string", format: "uuid", description: "The bill payment." },
                category: { type: ["string", "null"], enum: [...Object.values(BILL_CATEGORY), null] },
                billerName: { type: ["string", "null"], example: "MTN" },
                productName: { type: ["string", "null"], example: "1.5GB - 30 days" },
                customerId: { type: ["string", "null"], example: "08031234567", description: "Phone, meter or smartcard number." },
                token: { type: ["string", "null"], example: "1234-5678-9012-3456-7890", description: "Prepaid electricity token to enter on the meter; null until the bill completes, and for anything that has none." },
            },
        },
    },
});

export const statementItem = statementLine(depositSummary);

const detailLine = statementLine({
    ...depositSummary,
    rateNgnPerUsd: { type: ["string", "null"], example: "1575.60" },
    txHash: { type: ["string", "null"] },
    confirmations: { type: ["integer", "null"] },
    detectedAt: { type: ["string", "null"], format: "date-time" },
    completedAt: { type: ["string", "null"], format: "date-time" },
});

export const statementDetail = {
    ...detailLine,
    properties: {
        ...detailLine.properties,
        withdrawal: {
            type: ["object", "null"],
            description: "Set for withdrawals to a bank: the receipt.",
            properties: {
                id: { type: "string", format: "uuid" },
                reference: { type: "string", description: "Quote this to support." },
                status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
                recipient: {
                    type: "object",
                    properties: {
                        name: { type: ["string", "null"], example: "ADA OKAFOR" },
                        bankName: { type: ["string", "null"], example: "OPay - Paycom" },
                        accountNumber: { type: ["string", "null"], example: "8031234567" },
                    },
                },
                narration: { type: "string", example: "Ziks withdrawal" },
                amount: { type: "string", example: "100.00", description: "What the recipient gets." },
                fee: { type: "string", example: "20.00", description: "The real fee once the payout settles; the reserved fee until then." },
                total: { type: "string", example: "120.00", description: "amount + fee — what left the balance." },
                failureReason: { type: ["string", "null"] },
                requestedAt: { type: ["string", "null"], format: "date-time" },
                completedAt: { type: ["string", "null"], format: "date-time" },
            },
        },
        bankTransfer: {
            type: ["object", "null"],
            description: "Set for naira top-ups by bank transfer.",
            properties: {
                id: { type: "string", format: "uuid", description: "The naira deposit." },
                amountSent: { type: ["string", "null"], example: "500.00", description: "What the sender transferred." },
                fee: { type: ["string", "null"], example: "10.00", description: "The transfer fee the user bore (0.00 when Ziks absorbs it)." },
                amountCredited: { type: ["string", "null"], example: "490.00", description: "What reached the balance (amountSent − fee)." },
                sender: {
                    type: ["object", "null"],
                    description: "Who sent the money — the external account it came from (never Ziks's own), as the provider reports it. Account number masked to its last 4 digits. null until paid, or when the provider doesn't say.",
                    properties: {
                        name: { type: ["string", "null"], example: "ADA OKAFOR" },
                        bankName: { type: ["string", "null"], example: "First Bank" },
                        accountNumber: { type: ["string", "null"], example: "******1001" },
                    },
                },
            },
        },
    },
};

export const incomingDeposit = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        status: { type: "string", enum: [DEPOSIT_STATUS.PENDING, DEPOSIT_STATUS.FLAGGED] },
        subStatus: { type: ["string", "null"], example: "below_minimum" },
        symbol: { type: "string", example: "USDT" },
        network: { type: "string", example: "TRC20" },
        cryptoAmount: { type: "string", example: "100" },
        confirmations: { type: ["integer", "null"], example: 3 },
        txHash: { type: ["string", "null"] },
        detectedAt: dateTime,
    },
};
