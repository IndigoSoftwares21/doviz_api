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
    fossapay: NAIRA_FUNDING_MODE.ACCOUNT_NUMBER,
    korapay: NAIRA_FUNDING_MODE.BANK_TRANSFER,
};

/** Used when nothing (or something unknown) is set. */
export const DEFAULT_NAIRA_FUNDING_MODE = NAIRA_FUNDING_MODE.ACCOUNT_NUMBER;

/** Issues account numbers when the setting doesn't name one. */
export const DEFAULT_ACCOUNT_NUMBER_PROVIDER = "squad";

export const VIRTUAL_ACCOUNT_STATUS = {
    NONE: "none",
    ACTIVE: "active",
} as const;

export const NAIRA_FUNDING_MESSAGES = {
    VERIFY_FIRST: "Verify your identity first.",
    ACCOUNT_UNAVAILABLE: "We couldn't create your account number right now. Please try again.",
    ACCOUNT_REFUSED: "We couldn't open an account number with your verified details. Contact support and we'll sort it out.",
    USE_ACCOUNT_NUMBER: "Add money with your personal account number instead. Update the app if you don't see it.",
} as const;
