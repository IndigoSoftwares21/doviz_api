import { BILL_AMOUNT_TYPE, BILL_CATEGORY } from "@/constants/bills";
import { ProviderBillCatalog, ProviderBiller, ProviderBillProduct } from "../../types";
import FLUTTERWAVE from "./constants";
import { FlutterwaveBillItem } from "./flutterwaveTypes";
import { toFlutterwaveProductRef } from "./flutterwaveProductRef";
import toFlutterwaveMoney from "./toFlutterwaveMoney";
import parseFlutterwaveValidity from "./parseFlutterwaveValidity";

/**
 * Flutterwave's flat item list → raw billers + products. Translation only:
 * no renaming, matching or filtering (the shared sync does that). Flutterwave
 * repeats items, sometimes with different fees; the newest (highest id) wins.
 */
const mapFlutterwaveCatalog = ({ items }: { items: FlutterwaveBillItem[] }): ProviderBillCatalog => {
    const newest = new Map<string, FlutterwaveBillItem>();
    for (const item of items) {
        const currency = FLUTTERWAVE.COUNTRY_CURRENCY[item.country];
        if (!item.biller_code || !item.item_code || !currency) continue;
        const ref = toFlutterwaveProductRef({ billerCode: item.biller_code, itemCode: item.item_code });
        const seen = newest.get(ref);
        if (!seen || item.id > seen.id) newest.set(ref, item);
    }

    const billers = new Map<string, ProviderBiller>();
    const products: ProviderBillProduct[] = [];

    for (const [ref, item] of [...newest.entries()].sort(([, a], [, b]) => a.id - b.id)) {
        if (!billers.has(item.biller_code)) {
            const group = [...newest.values()].filter((other) => other.biller_code === item.biller_code);
            billers.set(item.biller_code, {
                providerBillerRef: item.biller_code,
                name: item.name,
                categoryHint: group.every((other) => other.is_airtime) ? BILL_CATEGORY.AIRTIME : null,
                customerIdLabel: item.label_name ?? null,
                logoUrl: item.logo ?? null,
            });
        }

        const price = item.amount > 0 ? toFlutterwaveMoney({ value: item.amount }) : null;
        products.push({
            providerProductRef: ref,
            providerBillerRef: item.biller_code,
            name: item.biller_name || item.short_name || item.name,
            amountType: price ? BILL_AMOUNT_TYPE.FIXED : BILL_AMOUNT_TYPE.RANGE,
            currency: FLUTTERWAVE.COUNTRY_CURRENCY[item.country],
            price,
            minAmount: null,
            maxAmount: null,
            providerFee: toFlutterwaveMoney({ value: item.fee }),
            validityDays: parseFlutterwaveValidity({ value: item.validity_period }),
        });
    }

    return { billers: [...billers.values()], products };
};

export default mapFlutterwaveCatalog;
