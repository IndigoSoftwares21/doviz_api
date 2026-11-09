import CRYPTO from "@/constants/crypto";
import { CryptoProvider } from "./cryptoProvider";

/**
 * Holds provider instances by name. Old addresses keep using the provider
 * that issued them; NEW addresses use the active one (CRYPTO_PROVIDER).
 */
class ProviderRegistry {
    private readonly providers = new Map<string, CryptoProvider>();

    register(provider: CryptoProvider) {
        this.providers.set(provider.name, provider);
    }

    get({ name }: { name: string }) {
        const provider = this.providers.get(name);
        if (!provider) {
            throw new Error(`Crypto provider "${name}" is not registered`);
        }
        return provider;
    }

    has({ name }: { name: string }) {
        return this.providers.has(name);
    }

    /** Provider for new deposit addresses and new payouts. */
    active() {
        return this.get({ name: process.env.CRYPTO_PROVIDER || CRYPTO.DEFAULT_PROVIDER });
    }

    /** Tests only. */
    reset() {
        this.providers.clear();
    }
}

const providerRegistry = new ProviderRegistry();

export default providerRegistry;
