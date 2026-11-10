import { PayoutProvider } from "./payoutProvider";

/**
 * Payout provider instances by name. Which one takes NEW withdrawals lives in
 * the database (provider_settings, see fetchActivePayoutProvider); in-flight
 * withdrawals use the provider on their own row.
 */
class PayoutProviderRegistry {
    private readonly providers = new Map<string, PayoutProvider>();

    register(provider: PayoutProvider) {
        this.providers.set(provider.name, provider);
    }

    get({ name }: { name: string }) {
        const provider = this.providers.get(name);
        if (!provider) throw new Error(`Payout provider "${name}" is not registered`);
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

const payoutProviderRegistry = new PayoutProviderRegistry();

export default payoutProviderRegistry;
