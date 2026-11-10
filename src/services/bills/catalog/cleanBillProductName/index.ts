import { BILL_AMOUNT_TYPE, BILL_CATEGORY, BillAmountType, BillCategory } from "@/constants/bills";
import normalizeBillText from "../normalizeBillText";

/** Words that describe the KIND of thing, not which one — dropped from fixed-price names. */
const NOISE = /\b(DATA|BUNDLES?|VTU|TOP ?UP|TOPUP|PAYMENTS?|SUBSCRIPTIONS?|BILLS?|NIGERIA|PURCHASE)\b/g;
const UNITS = new Set(["KB", "MB", "GB", "TB"]);

/**
 * Casing for the cleaned words. A provider that wrote the name in mixed case
 * ("Asian + HD/ExtraView") knows its brand casing best, so its words are kept
 * as written — except long all-caps words, which are shouting ("SMART" →
 * "Smart") rather than acronyms ("HD", "DSTV"). An ALL-CAPS name is title-cased.
 */
const recase = ({ cleaned, rawName }: { cleaned: string; rawName: string }) => {
    const rawWords = new Map<string, string>();
    if (/[a-z]/.test(rawName)) {
        for (const word of rawName.split(/[^A-Za-z0-9.+]+/)) {
            const shouting = word.length > 4 && word === word.toUpperCase();
            if (word && !shouting && !rawWords.has(word.toUpperCase())) rawWords.set(word.toUpperCase(), word);
        }
    }

    return cleaned
        .split(" ")
        .filter(Boolean)
        .map((word) => {
            if (UNITS.has(word) || /\d/.test(word)) return word;
            return rawWords.get(word) ?? word.charAt(0) + word.slice(1).toLowerCase();
        })
        .join(" ");
};

/**
 * A readable product name from a provider's raw one, for any provider:
 *   "AIRTEL 1.3GB data bundle" (biller AIRTEL) → "1.3GB"
 *   "IKEDC  PREPAID" (electricity)             → "Prepaid"
 *   "SMART - One Month"                        → "Smart One Month"
 *   "Asian + HD/ExtraView"                     → "Asian + HD ExtraView"
 * Strips the biller's own keywords and generic words; falls back to the raw
 * name (tidied) rather than ever returning nothing. A manual display_name
 * still overrides this.
 */
const cleanBillProductName = ({
    rawName,
    category,
    amountType,
    billerKeywords,
}: {
    rawName: string;
    category: BillCategory | null;
    amountType: BillAmountType;
    billerKeywords: string[];
}) => {
    const text = normalizeBillText({ text: rawName });

    if (category === BILL_CATEGORY.AIRTIME) return "Airtime";
    if (category === BILL_CATEGORY.ELECTRICITY) {
        if (/\bPRE ?PAID\b/.test(text)) return "Prepaid";
        if (/\bPOST ?PAID\b/.test(text)) return "Postpaid";
    }
    if (amountType === BILL_AMOUNT_TYPE.RANGE) return "Top-up";

    let cleaned = ` ${text} `;
    for (const keyword of billerKeywords) {
        const word = normalizeBillText({ text: keyword });
        if (word) cleaned = cleaned.split(` ${word} `).join(" ");
    }
    cleaned = cleaned
        .replace(NOISE, " ")
        .replace(/(\d)\s+(KB|MB|GB|TB)\b/g, "$1$2")
        .replace(/^[\s+-]+|[\s+-]+$/g, "")
        .replace(/\s+/g, " ");

    return recase({ cleaned: cleaned || text, rawName });
};

export default cleanBillProductName;
