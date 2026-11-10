import billProviderRegistry from "@/services/bills/billProviderRegistry";
import selectBillers from "./queries/selectBillers";

/** Billers the active bill provider can sell right now, optionally for one category. */
const fetchBillers = async ({ category }: { category?: string }) => {
    const provider = billProviderRegistry.active();
    const data = await selectBillers({ provider: provider.name, environment: provider.environment, category });

    return { data };
};

export default fetchBillers;
