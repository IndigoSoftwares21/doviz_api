/** How the app groups plans (data bundles, cable plans) — the same whichever provider sells them. */
export const BILL_VALIDITY_GROUPS = ["daily", "weekly", "monthly", "quarterly", "long_term", "other"] as const;

export type BillValidityGroup = (typeof BILL_VALIDITY_GROUPS)[number];

/**
 * daily 1–2 days · weekly 3–14 · monthly 15–45 · quarterly 46–120 ·
 * long_term over 120 · other when the validity isn't known (e.g. router plans).
 */
const billValidityGroup = ({ validityDays }: { validityDays: number | null }): BillValidityGroup => {
    if (validityDays === null || validityDays <= 0) return "other";
    if (validityDays <= 2) return "daily";
    if (validityDays <= 14) return "weekly";
    if (validityDays <= 45) return "monthly";
    if (validityDays <= 120) return "quarterly";
    return "long_term";
};

export default billValidityGroup;
