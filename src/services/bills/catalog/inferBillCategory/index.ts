import { BILL_CATEGORY, BillCategory } from "@/constants/bills";
import normalizeBillText from "../normalizeBillText";

/** Checked in order: "MTN DATA BUNDLE" must be data before anything else. */
const RULES: { category: BillCategory; name: RegExp; label?: RegExp }[] = [
    { category: BILL_CATEGORY.DATA, name: /\b(DATA|BUNDLES?)\b/ },
    { category: BILL_CATEGORY.AIRTIME, name: /\b(VTU|AIRTIME|RECHARGE)\b/ },
    { category: BILL_CATEGORY.ELECTRICITY, name: /\b(DISCO|ELECTRIC|ELECTRICITY|POWER)\b|EDCO?\b/, label: /\bMETER\b/ },
    { category: BILL_CATEGORY.CABLE_TV, name: /\b(DSTV|GOTV|STARTIMES|CABLE|TV)\b/, label: /\b(SMART ?CARD|IUC|DECODER)\b/ },
    { category: BILL_CATEGORY.INTERNET, name: /\b(INTERNET|BROADBAND|WIFI|SMILE|SPECTRANET|IPNX)\b/ },
];

/**
 * A provider biller's category from its raw name and customer-id label, for
 * providers that don't state it. null = can't tell (left for review).
 */
const inferBillCategory = ({ name, customerIdLabel }: { name: string; customerIdLabel: string | null }): BillCategory | null => {
    const text = normalizeBillText({ text: name });
    const label = normalizeBillText({ text: customerIdLabel ?? "" });

    const byName = RULES.find((rule) => rule.name.test(text));
    if (byName) return byName.category;

    const byLabel = RULES.find((rule) => rule.label?.test(label));
    return byLabel?.category ?? null;
};

export default inferBillCategory;
