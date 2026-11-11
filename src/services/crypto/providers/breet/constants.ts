import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";

/** Breet-specific constants. Nothing outside this folder imports them. */
const BREET = {
    /** `type` Breet gives a chain's own coin (vs a token standard like ERC20). */
    NATIVE_ASSET_TYPE: "BASE_ASSET",
    PROVIDER_NAME: "breet",
    DEFAULT_BASE_URL: "https://api.breet.io/v1",
    TIMEOUT_MS: 15_000,
    PAGE_SIZE: 100,
    MAX_PAGES: 50,
    CACHE_TTL_MS: 10 * 60 * 1000,
    /** Coin minimums follow the price, so they refresh more often than the asset list. */
    MIN_DEPOSIT_CACHE_TTL_MS: 5 * 60 * 1000,
    /** Breet's published webhook sender IPs. */
    WEBHOOK_IPS: ["46.101.201.155", "46.101.225.109", "46.101.225.97", "46.101.225.251", "159.89.20.62"],
    DEPOSIT_EVENTS: ["trade.pending", "trade.completed", "trade.flagged", "trade.deleted"],
    /** Sent (authenticated, no eventId) when a webhook URL is saved in the dashboard. */
    VERIFICATION_EVENT: "webhook.verification",
    ENVIRONMENTS: Object.values(PROVIDER_ENVIRONMENT),
} as const;

export default BREET;

/** Breet's trade statuses (their API vocabulary, mapped to ours in mapBreetStatus). */
export const BREET_TRADE_STATUS = {
    COMPLETED: "completed",
    FLAGGED: "flagged",
    DELETED: "deleted",
} as const;
