import { CryptoSendProvider } from "./cryptoSendProvider";

/**
 * Crypto-send provider instances by name. Which one takes NEW purchases lives
 * in the database (provider_settings 'crypto_sends'); in-flight purchases use
 * the provider on their own row.
 */
class CryptoSendProviderRegistry {
    private readonly providers = new Map<string, CryptoSendProvider>();

    register(provider: CryptoSendProvider) {
        this.providers.set(provider.name, provider);
    }

    get({ name }: { name: string }) {
        const provider = this.providers.get(name);
        if (!provider) throw new Error(`Crypto send provider "${name}" is not registered`);
        return provider;
    }

    has({ name }: { name: string }) {
        return this.providers.has(name);
    }

    names() {
        return [...this.providers.keys()];
    }

    /** Tests only. */
    reset() {
        this.providers.clear();
    }
}

const cryptoSendProviderRegistry = new CryptoSendProviderRegistry();

export default cryptoSendProviderRegistry;
