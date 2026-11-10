import { BillCategory } from "@/constants/bills";
import containsBillWord from "../containsBillWord";

export interface MatchableBiller {
    id: string;
    slug: string;
    categoryCode: string;
    matchKeywords: string[];
}

/**
 * Suggests which of OUR billers a provider biller is, using each biller's
 * `match_keywords` (data, not code — so any provider works) and the category.
 * Only a single confident candidate is suggested; anything else returns
 * billerId null with the reason, for a person to decide.
 */
const matchProviderBiller = ({
    name,
    category,
    billers,
}: {
    name: string;
    category: BillCategory | null;
    billers: MatchableBiller[];
}): { billerId: string | null; reason: string } => {
    const hits = billers
        .map((biller) => ({ biller, keyword: biller.matchKeywords.find((word) => containsBillWord({ text: name, word })) }))
        .filter((hit): hit is { biller: MatchableBiller; keyword: string } => hit.keyword !== undefined);

    if (hits.length === 0) return { billerId: null, reason: "No biller keyword in the provider name" };

    const candidates = category ? hits.filter((hit) => hit.biller.categoryCode === category) : hits;

    if (candidates.length === 1) {
        const [{ biller, keyword }] = candidates;
        const how = category ? `category ${category}` : "category unknown";
        return { billerId: biller.id, reason: `Keyword "${keyword}" → ${biller.slug} (${how})` };
    }

    const slugs = (candidates.length ? candidates : hits).map((hit) => hit.biller.slug).join(", ");
    if (candidates.length === 0) {
        return { billerId: null, reason: `Keyword matches ${slugs}, but none in category ${category}` };
    }
    return { billerId: null, reason: `Ambiguous: ${slugs}` };
};

export default matchProviderBiller;
