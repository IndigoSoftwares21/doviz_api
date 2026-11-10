import billProviderRegistry from "@/services/bills/billProviderRegistry";
import selectBillCategories from "./queries/selectBillCategories";

/** Categories the active bill provider can sell right now. */
const fetchBillCategories = async () => {
    const provider = billProviderRegistry.active();
    const data = await selectBillCategories({ provider: provider.name, environment: provider.environment });

    return { data };
};

export default fetchBillCategories;
