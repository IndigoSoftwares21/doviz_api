import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";

/** Flutterwave bill-payment constants (v3 API — v4 has no bills). Nothing outside this folder imports them. */
const FLUTTERWAVE = {
    PROVIDER_NAME: "flutterwave",
    DEFAULT_BASE_URL: "https://api.flutterwave.com/v3",
    /** Bill payments can be slow to answer; a timeout is treated as "outcome unknown". */
    TIMEOUT_MS: 30_000,
    /** Bills are Nigeria-only on Flutterwave. */
    COUNTRY: "NG",
    TEST_KEY_PREFIX: "FLWSECK_TEST",
    ENVIRONMENTS: Object.values(PROVIDER_ENVIRONMENT),
    /** Bill item `country` → the currency its amounts are in. */
    COUNTRY_CURRENCY: { NG: "NGN", GH: "GHS", KE: "KES", UG: "UGX", ZA: "ZAR" } as Record<string, string>,
} as const;

export default FLUTTERWAVE;
