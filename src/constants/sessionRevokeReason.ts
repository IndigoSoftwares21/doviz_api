/** Why an auth session was revoked (stored in auth_sessions.revoked_reason). */
const SESSION_REVOKE_REASON = {
    LOGOUT: "logout",
    DEVICE_REMOVED: "device_removed",
    REPLACED_BY_LOGIN: "replaced_by_login",
    REFRESH_TOKEN_REUSE: "refresh_token_reuse",
    PIN_LOCKED: "pin_locked",
} as const;

export type SessionRevokeReason = (typeof SESSION_REVOKE_REASON)[keyof typeof SESSION_REVOKE_REASON];

export default SESSION_REVOKE_REASON;
