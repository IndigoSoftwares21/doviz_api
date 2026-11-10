import BILLS from "@/constants/bills";
import { BillProvider } from "./billProvider";

/**
 * Holds bill provider instances by name. In-flight payments finish with the
 * provider that started them; NEW payments and catalog listings use the
 * active one (BILLS_PROVIDER).
 */
class BillProviderRegistry {
    private readonly providers = new Map<string, BillProvider>();

    register(provider: BillProvider) {
        this.providers.set(provider.name, provider);
    }

    get({ name }: { name: string }) {
        const provider = this.providers.get(name);
        if (!provider) {
            throw new Error(`Bill provider "${name}" is not registered`);
        }
        return provider;
    }

    has({ name }: { name: string }) {
        return this.providers.has(name);
    }

    /** Provider for new payments and catalog listings. */
    active() {
        return this.get({ name: process.env.BILLS_PROVIDER || BILLS.DEFAULT_PROVIDER });
    }

    /** Tests only. */
    reset() {
        this.providers.clear();
    }
}

const billProviderRegistry = new BillProviderRegistry();

export default billProviderRegistry;
