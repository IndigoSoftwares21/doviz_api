import normaliseTag from "@/utils/ziktags/normaliseTag";
import tagFormatProblem from "@/utils/ziktags/tagFormatProblem";
import selectUnavailableTags from "./selectUnavailableTags";
import { ZIKTAG_REASON, ZiktagReason } from "@/constants/ziktags";

/**
 * THE availability rule, shared by PUT /user/tag's schema and GET
 * /user/tag/check so they can never disagree: why `value` can't be this
 * user's Ziktag — "invalid", "reserved" or "taken" (held by, or on hold for,
 * someone else) — or null when it can. Never says who has it.
 */
const tagUnavailableReason = async ({ value, userId }: { value: string; userId: string }): Promise<{ tag: string; reason: ZiktagReason | null }> => {
    const tag = normaliseTag({ value });
    const problem = tagFormatProblem({ tag });
    if (problem) return { tag, reason: problem };

    const taken = (await selectUnavailableTags({ tags: [tag], userId })).has(tag);
    return { tag, reason: taken ? ZIKTAG_REASON.TAKEN : null };
};

export default tagUnavailableReason;
