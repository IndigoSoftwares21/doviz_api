import { ProviderEnvironment } from "@/constants/crypto";
import FLUTTERWAVE from "./constants";

export interface FlutterwaveConfig {
    baseUrl: string;
    secretKey: string;
    environment: ProviderEnvironment;
}

/**
 * Reads Flutterwave credentials from the environment, failing loudly if any is
 * missing — or if the key doesn't match FLUTTERWAVE_ENV, so a live key can
 * never be used by a sandbox setup (or the reverse).
 */
const getFlutterwaveConfig = (): FlutterwaveConfig => {
    const required = (name: string) => {
        const value = process.env[name];
        if (!value) throw new Error(`${name} must be set to use the Flutterwave bill provider`);
        return value;
    };

    const environment = required("FLUTTERWAVE_ENV");
    if (!(FLUTTERWAVE.ENVIRONMENTS as readonly string[]).includes(environment)) {
        throw new Error(`FLUTTERWAVE_ENV must be one of: ${FLUTTERWAVE.ENVIRONMENTS.join(", ")}`);
    }

    const secretKey = required("FLUTTERWAVE_SECRET_KEY");
    const isTestKey = secretKey.startsWith(FLUTTERWAVE.TEST_KEY_PREFIX);
    if (isTestKey !== (environment === "sandbox")) {
        throw new Error(`FLUTTERWAVE_SECRET_KEY is a ${isTestKey ? "test" : "live"} key but FLUTTERWAVE_ENV is ${environment}`);
    }

    return {
        baseUrl: process.env.FLUTTERWAVE_BASE_URL || FLUTTERWAVE.DEFAULT_BASE_URL,
        secretKey,
        environment: environment as ProviderEnvironment,
    };
};

export default getFlutterwaveConfig;
