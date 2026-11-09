/** Why a one-time code (SMS OTP or email code) was rejected (audit metadata). */
const CODE_FAILURE_REASON = {
    NO_LIVE_OTP: "no_live_otp",
    NO_LIVE_CODE: "no_live_code",
    INVALID_CODE: "invalid_code",
} as const;

export type CodeFailureReason = (typeof CODE_FAILURE_REASON)[keyof typeof CODE_FAILURE_REASON];

export default CODE_FAILURE_REASON;
