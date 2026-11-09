/** Outcomes of checking a transfer PIN. */
const PIN_VERIFICATION_STATUS = {
    VERIFIED: "verified",
    INVALID: "invalid",
    LOCKED: "locked",
    NOT_SET: "not_set",
} as const;

export default PIN_VERIFICATION_STATUS;
