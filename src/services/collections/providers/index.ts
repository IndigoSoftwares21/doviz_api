import monitoring from "@/utils/monitoring";
import collectionProviderRegistry from "../collectionProviderRegistry";
import KorapayCollectionProvider from "./korapay/korapayCollectionProvider";

/**
 * Registers every configured collection provider. Call once at startup.
 * A provider without credentials is skipped (with a warning), never half-configured.
 */
const registerCollectionProviders = () => {
    if (process.env.KORAPAY_SECRET_KEY) {
        const korapay = new KorapayCollectionProvider();
        if (!collectionProviderRegistry.has({ name: korapay.name })) collectionProviderRegistry.register(korapay);
    } else {
        monitoring.warn("KORAPAY_SECRET_KEY is not set; the Korapay collection provider is disabled");
    }
};

export default registerCollectionProviders;
