import monitoring from "@/utils/monitoring";
import payoutProviderRegistry from "../payoutProviderRegistry";
import KorapayPayoutProvider from "./korapay/korapayPayoutProvider";

/**
 * Registers every configured payout provider. Call once at startup. A provider
 * without credentials is skipped (with a warning), never half-configured.
 */
const registerPayoutProviders = () => {
    if (process.env.KORAPAY_SECRET_KEY) {
        const korapay = new KorapayPayoutProvider();
        if (!payoutProviderRegistry.has({ name: korapay.name })) payoutProviderRegistry.register(korapay);
    } else {
        monitoring.warn("KORAPAY_SECRET_KEY is not set; the Korapay payout provider is disabled");
    }
};

export default registerPayoutProviders;
