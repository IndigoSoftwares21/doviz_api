import providerRegistry from "@/services/crypto/providerRegistry";

/**
 * The active provider's environment (e.g. BREET_ENV for Breet). The catalog
 * sync uses the same value, so endpoints always read the rows it wrote.
 */
const getProviderEnvironment = () => providerRegistry.active().environment;

export default getProviderEnvironment;
