/** Ziks-to-Ziks transfers by Ziktag (INTERNAL_TRANSFERS_PLAN.md). */
const TRANSFERS = {
    /** The limits row everyone uses today (per-user / KYC-tier scopes later). */
    DEFAULT_SCOPE: "default",
    CURRENCY: "NGN",
    NOTE_MAX_LENGTH: 100,
    RECENT_RECIPIENTS: 10,
    /** Rolling window for the daily sending cap. */
    DAILY_WINDOW_HOURS: 24,
    /** Sends to this many different people within an hour raise an ops alert (never blocks). */
    VELOCITY_ALERT_RECIPIENTS: 5,
    VELOCITY_WINDOW_MINUTES: 60,
} as const;

export const TRANSFER_STATUS = {
    COMPLETED: "completed",
    REVERSED: "reversed",
} as const;

/** Relative to whoever is looking at it. */
export const TRANSFER_DIRECTION = {
    SENT: "sent",
    RECEIVED: "received",
} as const;

export type TransferDirection = (typeof TRANSFER_DIRECTION)[keyof typeof TRANSFER_DIRECTION];

export const TRANSFER_MESSAGES = {
    /** One answer for every reason (no such tag, inactive, yourself, no name): no enumeration. */
    RECIPIENT_NOT_FOUND: "No Ziks user with that Ziktag",
    INSUFFICIENT_BALANCE: "You don't have enough in your balance for this transfer.",
    ACCOUNT_INACTIVE: "Your account is not active. Please contact support.",
    INVALID_AMOUNT: "Enter a valid amount",
} as const;

export default TRANSFERS;
