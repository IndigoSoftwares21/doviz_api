/**
 * How users add naira. The app shows whichever flow the server says
 * (GET /naira-deposits/options), switched with `npm run funding:use -- <provider>`.
 */
export const NAIRA_FUNDING_MODE = {
    /** Verify identity once, then a personal account number for every top-up. */
    ACCOUNT_NUMBER: "account_number",
    /** A one-time account per top-up (amount first). */
    BANK_TRANSFER: "bank_transfer",
} as const;

export type NairaFundingMode = (typeof NAIRA_FUNDING_MODE)[keyof typeof NAIRA_FUNDING_MODE];

/** The flow each funding provider offers. */
export const NAIRA_FUNDING_PROVIDERS: Record<string, NairaFundingMode> = {
    squad: NAIRA_FUNDING_MODE.ACCOUNT_NUMBER,
    korapay: NAIRA_FUNDING_MODE.BANK_TRANSFER,
};

/** Used when nothing (or something unknown) is set. */
export const DEFAULT_NAIRA_FUNDING_MODE = NAIRA_FUNDING_MODE.ACCOUNT_NUMBER;

export const NAIRA_FUNDING_MESSAGES = {
    USE_ACCOUNT_NUMBER: "Add money with your personal account number instead. Update the app if you don't see it.",
} as const;
