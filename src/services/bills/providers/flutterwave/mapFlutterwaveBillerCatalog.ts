import { BILL_AMOUNT_TYPE, BillCategory } from "@/constants/bills";
import { ProviderBillCatalog, ProviderBillProduct } from "../../types";
import FLUTTERWAVE from "./constants";
import { FlutterwaveBiller, FlutterwaveBillerItem } from "./flutterwaveTypes";
import { toFlutterwaveProductRef } from "./flutterwaveProductRef";
import toFlutterwaveMoney from "./toFlutterwaveMoney";
import parseFlutterwaveValidity from "./parseFlutterwaveValidity";

export interface FlutterwaveBillerGroup {
    category: BillCategory;
    biller: FlutterwaveBiller;
    items: FlutterwaveBillerItem[];
}

/**
 * Flutterwave billers (with the category Flutterwave files them under) and
 * their items → raw billers + products. Translation only: no renaming or
 * matching. Repeated items: the newest (highest id) wins.
 */
const mapFlutterwaveBillerCatalog = ({ groups }: { groups: FlutterwaveBillerGroup[] }): ProviderBillCatalog => {
    const catalog: ProviderBillCatalog = { billers: [], products: [] };
    const seenBillers = new Set<string>();

    for (const { category, biller, items } of groups) {
        if (seenBillers.has(biller.biller_code)) continue;
        seenBillers.add(biller.biller_code);

        catalog.billers.push({
            providerBillerRef: biller.biller_code,
            name: biller.name,
            categoryHint: category,
            customerIdLabel: items.find((item) => item.label_name)?.label_name ?? null,
            logoUrl: biller.logo || null,
        });

        const newest = new Map<string, FlutterwaveBillerItem>();
        for (const item of items) {
            if (!item.item_code || !FLUTTERWAVE.COUNTRY_CURRENCY[item.country]) continue;
            const ref = toFlutterwaveProductRef({ billerCode: biller.biller_code, itemCode: item.item_code });
            const seen = newest.get(ref);
            if (!seen || item.id > seen.id) newest.set(ref, item);
        }

        for (const [ref, item] of [...newest.entries()].sort(([, a], [, b]) => a.id - b.id)) {
            const price = item.amount > 0 ? toFlutterwaveMoney({ value: item.amount }) : null;
            const product: ProviderBillProduct = {
                providerProductRef: ref,
                providerBillerRef: biller.biller_code,
                name: item.name,
                amountType: price ? BILL_AMOUNT_TYPE.FIXED : BILL_AMOUNT_TYPE.RANGE,
                currency: FLUTTERWAVE.COUNTRY_CURRENCY[item.country],
                price,
                minAmount: null,
                maxAmount: null,
                validityDays: parseFlutterwaveValidity({ value: item.validity_period }),
            };
            catalog.products.push(product);
        }
    }

    return catalog;
};

export default mapFlutterwaveBillerCatalog;
