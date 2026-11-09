import monitoring from "@/utils/monitoring";
import providerRegistry from "../providerRegistry";
import BreetProvider from "./breet/breetProvider";

/**
 * Registers every configured crypto provider. Call once at startup.
 * A provider without credentials is skipped (with a warning), never half-configured.
 */
const registerCryptoProviders = () => {
    if (process.env.BREET_APP_ID) {
        const breet = new BreetProvider();
        if (!providerRegistry.has({ name: breet.name })) providerRegistry.register(breet);
    } else {
        monitoring.warn("BREET_APP_ID is not set; the Breet crypto provider is disabled");
    }
};

export default registerCryptoProviders;
