import BREET from "./constants";
import { ProviderEnvironment } from "@/constants/crypto";

export interface BreetConfig {
    baseUrl: string;
    appId: string;
    appSecret: string;
    environment: ProviderEnvironment;
}

/** Reads Breet credentials from the environment, failing loudly if any is missing. */
const getBreetConfig = (): BreetConfig => {
    const required = (name: string) => {
        const value = process.env[name];
        if (!value) throw new Error(`${name} must be set to use the Breet provider`);
        return value;
    };

    const environment = required("BREET_ENV");
    if (!(BREET.ENVIRONMENTS as readonly string[]).includes(environment)) {
        throw new Error(`BREET_ENV must be one of: ${BREET.ENVIRONMENTS.join(", ")}`);
    }

    return {
        baseUrl: process.env.BREET_BASE_URL || BREET.DEFAULT_BASE_URL,
        appId: required("BREET_APP_ID"),
        appSecret: required("BREET_APP_SECRET"),
        environment: environment as BreetConfig["environment"],
    };
};

export default getBreetConfig;
