import billProviderRegistry from "@/services/bills/billProviderRegistry";
import selectBillProducts from "./queries/selectBillProducts";
import billValidityGroup from "@/utils/bills/billValidityGroup";
import billFee from "@/utils/bills/billFee";

/**
 * The active bill provider's products for one of our billers (the schema has
 * checked it's sellable), each with the validity group the app tabs them by.
 */
const fetchBillProducts = async ({ billerId }: { billerId: string }) => {
    const provider = billProviderRegistry.active();
    const rows = await selectBillProducts({ billerId, provider: provider.name, environment: provider.environment });

    const data = rows.map(({ id, name, amountType, currency, price, minAmount, maxAmount, serviceFee, providerFee, validityDays }) => ({
        id,
        name,
        amountType,
        currency,
        price,
        minAmount,
        maxAmount,
        serviceFee: billFee({ providerFee, serviceFee }),
        validityDays,
        validityGroup: billValidityGroup({ validityDays }),
    }));

    return { data };
};

export default fetchBillProducts;
