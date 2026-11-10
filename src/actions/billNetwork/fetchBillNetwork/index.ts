import billProviderRegistry from "@/services/bills/billProviderRegistry";
import detectMobileNetwork from "@/utils/bills/detectMobileNetwork";
import selectNetworkBillers from "./queries/selectNetworkBillers";
import { BILL_CATEGORY } from "@/constants/bills";

/**
 * The network a phone number most likely belongs to, with our airtime and
 * data billers for it (null when that network can't be paid right now).
 * Billers are found by our own slugs ("airtel-airtime"), so this works the
 * same whichever provider is active.
 */
const fetchBillNetwork = async ({ phone }: { phone: string }) => {
    const network = detectMobileNetwork({ phone });
    if (!network) return { data: { phone, network: null, airtimeBillerId: null, dataBillerId: null } };

    const provider = billProviderRegistry.active();
    const billers = await selectNetworkBillers({
        slugs: [`${network.code}-airtime`, `${network.code}-data`],
        provider: provider.name,
        environment: provider.environment,
    });
    const idFor = (category: string) => billers.find((biller) => biller.categoryCode === category)?.id ?? null;

    const data = { phone, network, airtimeBillerId: idFor(BILL_CATEGORY.AIRTIME), dataBillerId: idFor(BILL_CATEGORY.DATA) };

    return { data };
};

export default fetchBillNetwork;
