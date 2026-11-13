/**
 * Checks a person's KYC details against an official source (BVN/NIN records).
 * Provider-agnostic: IdentifyOrg is the current implementation; anything else
 * implements the same interface. Never logs a value.
 */
export const KYC_OUTCOME = {
    VERIFIED: "verified",
    REJECTED: "rejected",
    /** Couldn't check (outage, timeout, our setup) — nothing is decided or recorded. */
    UNAVAILABLE: "unavailable",
} as const;

export type KycOutcome = (typeof KYC_OUTCOME)[keyof typeof KYC_OUTCOME];

export interface KycVerification {
    outcome: KycOutcome;
    /** Shown to the user when rejected, e.g. "Your date of birth doesn't match your BVN." */
    reason: string | null;
    /** The verifier's own reference for this check. */
    reference: string | null;
    /** Per-field match results and scores — never values or images. */
    evidence: Record<string, boolean | number | null>;
}

export interface KycVerifier {
    readonly name: string;
    /** The levels it can decide. */
    readonly levels: readonly string[];
    /**
     * `values` by field key (decrypted, in memory only); a selfie is a data URI.
     * `contact` is what Ziks has already verified about the user (their phone,
     * confirmed by SMS code) — e.g. to match against the BVN record.
     */
    verify(args: { level: string; values: Record<string, string>; contact: { phoneNumber: string } }): Promise<KycVerification>;
}
