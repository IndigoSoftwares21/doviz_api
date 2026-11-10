import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";
import { BILL_CATEGORY, BillCategory } from "@/constants/bills";

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
    /**
     * Flutterwave's bill categories that are ours. Billers in any other
     * category (tax, donations, schools, government) are never fetched.
     */
    CATEGORY_MAP: {
        AIRTIME: BILL_CATEGORY.AIRTIME,
        MOBILEDATA: BILL_CATEGORY.DATA,
        UTILITYBILLS: BILL_CATEGORY.ELECTRICITY,
        CABLEBILLS: BILL_CATEGORY.CABLE_TV,
        INTSERVICE: BILL_CATEGORY.INTERNET,
    } as Record<string, BillCategory>,
} as const;

export default FLUTTERWAVE;
