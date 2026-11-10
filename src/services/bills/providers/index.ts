import monitoring from "@/utils/monitoring";
import billProviderRegistry from "../billProviderRegistry";
import FlutterwaveBillProvider from "./flutterwave/flutterwaveBillProvider";

/**
 * Registers every configured bill provider. Call once at startup.
 * A provider without credentials is skipped (with a warning), never half-configured.
 */
const registerBillProviders = () => {
    if (process.env.FLUTTERWAVE_SECRET_KEY) {
        const flutterwave = new FlutterwaveBillProvider();
        if (!billProviderRegistry.has({ name: flutterwave.name })) billProviderRegistry.register(flutterwave);
    } else {
        monitoring.warn("FLUTTERWAVE_SECRET_KEY is not set; the Flutterwave bill provider is disabled");
    }
};

export default registerBillProviders;
