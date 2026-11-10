import { ProviderEnvironment } from "@/constants/crypto";
import KORAPAY from "./constants";

export interface KorapayConfig {
    baseUrl: string;
    secretKey: string;
    /** Only some endpoints (the bank list) take the public key; null when not configured. */
    publicKey: string | null;
    environment: ProviderEnvironment;
    /** Sent as each charge's notification_url: API_PUBLIC_URL + /api/<version>/webhooks/korapay. null = the dashboard's URL. */
    webhookUrl: string | null;
    /** Korapay requires a customer email; used for users who haven't added one. */
    fallbackCustomerEmail: string | null;
}

/**
 * Reads Korapay credentials from the environment, failing loudly if any is
 * missing — or if the key doesn't match KORAPAY_ENV, so a live key can never
 * be used by a sandbox setup (or the reverse).
 */
const getKorapayConfig = (): KorapayConfig => {
    const required = (name: string) => {
        const value = process.env[name];
        if (!value) throw new Error(`${name} must be set to use the Korapay collection provider`);
        return value;
    };

    const environment = required("KORAPAY_ENV");
    if (!(KORAPAY.ENVIRONMENTS as readonly string[]).includes(environment)) {
        throw new Error(`KORAPAY_ENV must be one of: ${KORAPAY.ENVIRONMENTS.join(", ")}`);
    }

    const secretKey = required("KORAPAY_SECRET_KEY");
    const isTestKey = secretKey.startsWith(KORAPAY.TEST_KEY_PREFIX);
    if (isTestKey !== (environment === "sandbox")) {
        throw new Error(`KORAPAY_SECRET_KEY is a ${isTestKey ? "test" : "live"} key but KORAPAY_ENV is ${environment}`);
    }

    return {
        baseUrl: process.env.KORAPAY_BASE_URL || KORAPAY.DEFAULT_BASE_URL,
        secretKey,
        publicKey: process.env.KORAPAY_PUBLIC_KEY || null,
        environment: environment as ProviderEnvironment,
        webhookUrl: process.env.API_PUBLIC_URL
            ? `${process.env.API_PUBLIC_URL.replace(/\/+$/, "")}/api/${process.env.API_VERSION || "v1"}/webhooks/${KORAPAY.PROVIDER_NAME}`
            : null,
        fallbackCustomerEmail: process.env.KORAPAY_FALLBACK_CUSTOMER_EMAIL || null,
    };
};

export default getKorapayConfig;
