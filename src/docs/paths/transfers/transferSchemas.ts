const money = (example: string) => ({ type: "string", example });
const tag = { type: "string", example: "ada", description: "Lowercase, without \"@\"." };

export const transferTags = [
    {
        name: "Transfers",
        description: "Send naira to another Ziks user by their Ziktag: instant and free. One ledger posting, no bank or provider. A completed transfer can't be reversed by the sender.",
    },
];

export const transferRecipient = {
    type: "object",
    properties: {
        recipientId: { type: "string", format: "uuid", description: "Send this to POST /transfers." },
        tag,
        displayName: { type: "string", example: "Ada O.", description: "First name and last initial — never the full surname, phone or email." },
        initials: { type: "string", example: "AO" },
    },
};

export const transferLimits = {
    type: "object",
    properties: {
        currency: { type: "string", example: "NGN" },
        minAmount: money("100.00"),
        maxPerTransfer: money("1000000.00"),
        maxPerDay: { ...money("1000000.00"), description: "Rolling 24 hours of completed sends." },
        sentToday: money("360000.00"),
        remainingToday: { ...money("640000.00"), description: "What can still be sent now: \"You can send up to ₦640,000 more today\"." },
    },
};

export const transfer = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        amount: money("5000.00"),
        currency: { type: "string", example: "NGN" },
        note: { type: ["string", "null"], example: "for lunch" },
        status: { type: "string", enum: ["completed", "reversed"] },
        direction: { type: "string", enum: ["sent", "received"], description: "From the viewer's side." },
        counterparty: {
            type: "object",
            properties: {
                tag: { ...tag, type: ["string", "null"], description: "The Ziktag used at the time; null only for a sender who had none." },
                displayName: { type: "string", example: "Ada O." },
                initials: { type: "string", example: "AO" },
            },
        },
        reference: { type: "string", example: "ZT-3F9A1C2B7D4E", description: "Quote this to support." },
        createdAt: { type: "string", format: "date-time" },
    },
};

/** On statement lines (list and detail). */
export const statementTransfer = {
    type: ["object", "null"],
    description: "Set for Ziks-to-Ziks transfers.",
    properties: {
        direction: { type: "string", enum: ["sent", "received"] },
        counterpartyTag: { type: ["string", "null"], example: "ada" },
        counterpartyName: { type: "string", example: "Ada O." },
        note: { type: ["string", "null"], example: "for lunch" },
    },
};
