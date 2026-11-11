import ZIKTAGS from "@/constants/ziktags";

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the next change is allowed after one at `changedAt` (null if never changed). */
export const nextChangeAt = (changedAt: Date | null) => (changedAt ? new Date(changedAt.getTime() + ZIKTAGS.CHANGE_COOLDOWN_DAYS * DAY_MS) : null);

/** Until when a tag released at `releasedAt` stays held for its old owner. */
export const heldUntil = (releasedAt: Date) => new Date(releasedAt.getTime() + ZIKTAGS.HOLD_DAYS * DAY_MS);
