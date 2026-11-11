import tagUnavailableReason from "@/schemaHelpers/tagUnavailableReason";
import tagFormatProblem from "@/utils/ziktags/tagFormatProblem";
import tagCandidates from "@/utils/ziktags/tagCandidates";
import selectUnavailableTags from "@/schemaHelpers/selectUnavailableTags";
import selectTagOwnerName from "./queries/selectTagOwnerName";
import ZIKTAGS from "@/constants/ziktags";

/**
 * Can this user take `tag`? Only available + a reason — never who has it.
 * The user's own current tag counts as available. When it isn't available,
 * up to 3 alternatives built from the tag and the user's name.
 */
const fetchTagAvailability = async ({ userId, value }: { userId: string; value: string }) => {
    const { tag, reason } = await tagUnavailableReason({ value, userId });
    if (!reason) return { data: { tag, available: true, reason: null, suggestions: [] as string[] } };

    const user = await selectTagOwnerName({ userId });
    const base = ZIKTAGS.FORMAT.test(tag) ? tag.slice(0, ZIKTAGS.MAX_LENGTH - 4) : null;
    const fromTag = base ? [`${base}_ng`, `${base}${Math.floor(Math.random() * 900) + 100}`, `the_${base}`] : [];
    const ideas = [...fromTag, ...tagCandidates({ firstName: user?.firstName, lastName: user?.lastName })].filter(
        (candidate) => candidate !== tag && tagFormatProblem({ tag: candidate }) === null,
    );
    const unavailable = await selectUnavailableTags({ tags: ideas, userId });
    const suggestions = [...new Set(ideas)].filter((candidate) => !unavailable.has(candidate)).slice(0, ZIKTAGS.MAX_CHECK_SUGGESTIONS);

    return { data: { tag, available: false, reason, suggestions } };
};

export default fetchTagAvailability;
