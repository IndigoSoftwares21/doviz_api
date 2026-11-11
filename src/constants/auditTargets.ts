/** Who performed an audited action. */
export const AUDIT_ACTOR_TYPE = {
    ANONYMOUS: "anonymous",
    USER: "user",
    ADMIN: "admin",
    SYSTEM: "system",
} as const;

/** What an audited action was about (usually the table name of entityId). */
export const AUDIT_ENTITY_TYPE = {
    USER: "user",
    AUTH_SESSION: "auth_session",
    USER_DEVICE: "user_device",
    PHONE_OTP: "phone_otp",
    EMAIL_VERIFICATION: "email_verification",
    BIOMETRIC_KEY: "biometric_key",
    BIOMETRIC_CHALLENGE: "biometric_challenge",
    CRYPTO_WALLET: "crypto_wallet",
    CRYPTO_DEPOSIT: "crypto_deposit",
    USER_BANK_ACCOUNT: "user_bank_account",
    BILL_PAYMENT: "bill_payment",
    BANK_WITHDRAWAL: "bank_withdrawal",
    PROVIDER_SETTING: "provider_setting",
    NAIRA_DEPOSIT: "naira_deposit",
    CRYPTO_PURCHASE: "crypto_purchase",
    CRYPTO_BUY_RATE: "crypto_buy_rate",
    CRYPTO_BUY_MARKUP: "crypto_buy_markup",
    CRYPTO_STOCK_MOVEMENT: "crypto_stock_movement",
    INTERNAL_TRANSFER: "internal_transfer",
    TRANSFER_LIMIT: "transfer_limit",
} as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPE)[keyof typeof AUDIT_ACTOR_TYPE];
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPE)[keyof typeof AUDIT_ENTITY_TYPE];
