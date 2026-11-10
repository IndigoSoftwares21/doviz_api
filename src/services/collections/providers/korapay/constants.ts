import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";

/** Korapay collection constants. Nothing outside this folder imports them. */
const KORAPAY = {
    PROVIDER_NAME: "korapay",
    DEFAULT_BASE_URL: "https://api.korapay.com/merchant/api/v1",
    TIMEOUT_MS: 20_000,
    CURRENCY: "NGN",
    TEST_KEY_PREFIX: "sk_test_",
    ENVIRONMENTS: Object.values(PROVIDER_ENVIRONMENT),
    SIGNATURE_HEADER: "x-korapay-signature",
    /** Charge events: charge.success, charge.failed. */
    CHARGE_EVENT_PREFIX: "charge.",
    /** Payout events (same webhook URL): transfer.success, transfer.failed. */
    TRANSFER_EVENT_PREFIX: "transfer.",
} as const;

export default KORAPAY;
