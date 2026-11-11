/** Ziktags (@handles). Values match the DB CHECK on users.tag. */
const ZIKTAGS = {
    FORMAT: /^[a-z][a-z0-9_]{2,19}$/,
    MAX_LENGTH: 20,
    /** After a change, the next one is allowed this many days later (not on first set). */
    CHANGE_COOLDOWN_DAYS: 30,
    /** A released tag is held for its old owner this long. */
    HOLD_DAYS: 30,
    MAX_CHECK_SUGGESTIONS: 3,
    MAX_SUGGESTIONS: 5,
} as const;

/** Why a tag can't be used. */
export const ZIKTAG_REASON = {
    INVALID: "invalid",
    RESERVED: "reserved",
    TAKEN: "taken",
} as const;

/** Exactly these can never be taken. */
export const ZIKTAG_RESERVED = new Set([
    "ziks", "ziktag", "support", "admin", "help", "official", "team", "security", "staff", "ceo", "root",
    "system", "api", "payments", "wallet", "money", "bank", "null", "undefined", "me", "you", "everyone",
]);

/** A tag that STARTS or ENDS with one of these looks official (ziks_support, adminfaith, help_desk_ng). */
export const ZIKTAG_OFFICIAL_AFFIXES = ["ziks", "support", "admin", "official", "help", "security", "staff", "team", "verify", "refund"];

/** Basic profanity/slur list: a tag CONTAINING one of these is refused. Keep it small and obvious. */
export const ZIKTAG_BLOCKED_WORDS = ["fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "whore", "rapist", "porn"];

/** Why setting a tag failed (the controller maps each to a response). */
export const ZIKTAG_FAILURE = {
    INVALID: "invalid",
    RESERVED: "reserved",
    TAKEN: "taken",
    COOLDOWN: "cooldown",
    PIN_REQUIRED: "pin_required",
    PIN: "pin",
} as const;

export const ZIKTAG_MESSAGES = {
    INVALID: "Use 3–20 letters, numbers or underscores, starting with a letter",
    RESERVED: "That Ziktag isn't available",
    TAKEN: "That Ziktag is taken",
    PIN_REQUIRED: "Enter your PIN to change your Ziktag",
    /** Each unavailable reason's message (validationErrors on `tag`). */
    BY_REASON: {
        invalid: "Use 3–20 letters, numbers or underscores, starting with a letter",
        reserved: "That Ziktag isn't available",
        taken: "That Ziktag is taken",
    },
} as const;

export type ZiktagReason = (typeof ZIKTAG_REASON)[keyof typeof ZIKTAG_REASON];

export default ZIKTAGS;
