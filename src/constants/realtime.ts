/** Server → app push events over the authenticated socket. */
const REALTIME = {
    /** Socket.IO endpoint path (next to /api/v1/app). */
    PATH: "/api/v1/realtime",
    /**
     * Postgres NOTIFY channel. Events are published inside the transaction
     * that made the change, so they go out only if it commits — and every
     * API instance LISTENs, so a user's socket gets it whichever instance
     * (request, webhook, job) made the change.
     */
    CHANNEL: "doviz_user_events",
    /** Room each socket joins: one per user, all their devices. */
    userRoom: (userId: string) => `user:${userId}`,
} as const;

/** Event names the app listens for. Payloads are tiny: the app fetches details over HTTP. */
export const REALTIME_EVENT = {
    /** { billPaymentId, status } — a bill payment was created, completed or refunded. */
    BILL_PAYMENT_UPDATED: "bill_payment.updated",
    /** { nairaDepositId, status } — a naira deposit was completed, expired or failed. */
    NAIRA_DEPOSIT_UPDATED: "naira_deposit.updated",
    /** { withdrawalId, status } — a withdrawal to the user's bank completed or failed (refunded). */
    WITHDRAWAL_UPDATED: "withdrawal.updated",
    /** { cryptoPurchaseId, status } — a crypto purchase was sent, failed (refunded) or needs review. */
    CRYPTO_PURCHASE_UPDATED: "crypto_purchase.updated",
    /** { transferId, amount, senderTag } — another Ziks user sent this user money (senderTag null if they have no Ziktag). */
    TRANSFER_RECEIVED: "transfer.received",
    /** { accountNumber } — the user's personal account number is ready. */
    VIRTUAL_ACCOUNT_READY: "virtual_account.ready",
    /** {} — the naira balance changed (payment held, refund, deposit credited). */
    WALLET_BALANCE_CHANGED: "wallet.balance_changed",
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT];

export default REALTIME;
