import NAIRA_DEPOSITS, { FEE_BEARER, FeeBearer } from "@/constants/nairaDeposits";
import { CollectionProvider } from "./collectionProvider";

/**
 * Holds collection provider instances by name. In-flight deposits finish
 * with the provider that issued them; NEW deposits try the active providers
 * in order (NAIRA_COLLECTION_PROVIDERS, e.g. "korapay,paystack").
 */
class CollectionProviderRegistry {
    private readonly providers = new Map<string, CollectionProvider>();

    register(provider: CollectionProvider) {
        this.providers.set(provider.name, provider);
    }

    get({ name }: { name: string }) {
        const provider = this.providers.get(name);
        if (!provider) {
            throw new Error(`Collection provider "${name}" is not registered`);
        }
        return provider;
    }

    has({ name }: { name: string }) {
        return this.providers.has(name);
    }

    /** Registered providers for new deposits, most preferred first. Empty = deposits unavailable. */
    active() {
        const configured = process.env.NAIRA_COLLECTION_PROVIDERS;
        const names = configured ? configured.split(",").map((name) => name.trim()).filter(Boolean) : [...NAIRA_DEPOSITS.DEFAULT_PROVIDERS];
        return names.filter((name) => this.providers.has(name)).map((name) => this.get({ name }));
    }

    /** Who pays the provider's fee on NEW deposits. The user, unless NAIRA_DEPOSIT_FEE_BEARER=doviz. */
    feeBearer(): FeeBearer {
        return process.env.NAIRA_DEPOSIT_FEE_BEARER === FEE_BEARER.DOVIZ ? FEE_BEARER.DOVIZ : FEE_BEARER.USER;
    }

    /** Tests only. */
    reset() {
        this.providers.clear();
    }
}

const collectionProviderRegistry = new CollectionProviderRegistry();

export default collectionProviderRegistry;
