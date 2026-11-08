const AUTH = {
    OTP_LENGTH: 6,
    OTP_PURPOSE_LOGIN: "login",
    OTP_PURPOSE_PIN_RESET: "pin_reset",
    OTP_TTL_SECONDS: 5 * 60,
    OTP_MAX_ATTEMPTS: 5,
    OTP_RESEND_COOLDOWN_SECONDS: 60,
    OTP_MAX_REQUESTS_PER_HOUR: 5,
    EMAIL_OTP_TTL_SECONDS: 10 * 60,
    EMAIL_OTP_MAX_ATTEMPTS: 5,
    EMAIL_OTP_RESEND_COOLDOWN_SECONDS: 60,
    EMAIL_OTP_MAX_REQUESTS_PER_HOUR: 5,
    PIN_LENGTH: 4,
    PIN_MAX_ATTEMPTS: 5,
    PIN_LOCK_SECONDS: 30 * 60,
    PIN_BCRYPT_ROUNDS: 12,
    BIOMETRIC_CHALLENGE_TTL_SECONDS: 2 * 60,
    BIOMETRIC_PURPOSE_VERIFICATION: "verification",
    BIOMETRIC_PURPOSE_LOGIN: "login",
    DEVICE_PLATFORMS: ["ios", "android", "web"],
    // Doubles as the idle lock: once it expires the app must unlock with the
    // PIN or biometrics (POST /auth/session/unlock).
    ACCESS_TOKEN_TTL_SECONDS: 5 * 60,
    REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
    JWT_ISSUER: "doviz-api",
    JWT_AUDIENCE: "doviz-app",
    // E.164: "+" then country code (no leading zero), 8-15 digits total.
    E164_REGEX: /^\+[1-9]\d{7,14}$/,
} as const;

export default AUTH;
