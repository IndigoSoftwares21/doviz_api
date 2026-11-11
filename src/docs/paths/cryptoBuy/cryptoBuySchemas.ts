const money = (example: string | null, description?: string) => ({
    type: example === null ? ["string", "null"] : "string",
    pattern: "^[0-9]+\\.[0-9]{2}$",
    example,
    ...(description ? { description } : {}),
});

const coin = (example: string, description?: string) => ({ type: "string", example, ...(description ? { description } : {}) });

export const buyAsset = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        symbol: { type: "string", example: "USDT" },
        network: { type: "string", example: "TRC20", description: "Send only on this network — a coin sent on another network can be lost." },
        name: { type: "string", example: "Tether USD (TRC20)" },
    },
};

export const buyAssetListItem = {
    type: "object",
    properties: {
        ...buyAsset.properties,
        memoRequired: { type: "boolean", example: false },
        minAmount: { type: ["string", "null"], example: "1" },
        networkFee: { type: ["string", "null"], example: "1", description: "In the coin; priced into the naira total." },
        currency: { type: "string", example: "NGN" },
        unitPrice: money("1650.00", "Naira per coin right now; null while prices are being updated."),
        isAvailable: { type: "boolean", example: true },
    },
};

export const buyQuote = {
    type: "object",
    properties: {
        asset: buyAsset,
        memoRequired: { type: "boolean", example: false },
        cryptoAmount: coin("10", "Exactly what arrives at the address."),
        networkFee: coin("1", "The network fee in the coin (included in `total`)."),
        unitPrice: money("1650.00"),
        currency: { type: "string", example: "NGN" },
        nairaAmount: money("16500.00"),
        nairaFee: money("1650.00", "The network fee in naira."),
        total: money("18150.00", "Taken from the balance. Send back as `expectedTotal`."),
        expiresAt: { type: "string", format: "date-time", description: "When this price stops being offered." },
    },
};

export const cryptoPurchase = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["pending", "processing", "needs_review", "completed", "failed"], description: "`needs_review`: we're confirming with our partner — the naira stays held, never lost." },
        asset: buyAsset,
        address: { type: "string", example: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
        memo: { type: ["string", "null"], example: null },
        cryptoAmount: coin("10"),
        networkFee: coin("1"),
        unitPrice: money("1650.00"),
        currency: { type: "string", example: "NGN" },
        nairaAmount: money("16500.00"),
        nairaFee: money("1650.00"),
        total: money("18150.00"),
        txHash: { type: ["string", "null"], example: null, description: "The on-chain transaction, once sent." },
        failureReason: { type: ["string", "null"], example: null, description: "Shown when failed (the naira is already back)." },
        createdAt: { type: "string", format: "date-time" },
        completedAt: { type: ["string", "null"], format: "date-time" },
    },
};
