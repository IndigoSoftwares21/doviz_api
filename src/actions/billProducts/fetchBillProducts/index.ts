import billProviderRegistry from "@/services/bills/billProviderRegistry";
import selectBillProducts from "./queries/selectBillProducts";

/** The active bill provider's products for one of our billers (the schema has checked it's sellable). */
const fetchBillProducts = async ({ billerId }: { billerId: string }) => {
    const provider = billProviderRegistry.active();
    const data = await selectBillProducts({ billerId, provider: provider.name, environment: provider.environment });

    return { data };
};

export default fetchBillProducts;
