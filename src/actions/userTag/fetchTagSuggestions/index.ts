import tagCandidates from "@/utils/ziktags/tagCandidates";
import selectUnavailableTags from "@/schemaHelpers/selectUnavailableTags";
import selectTagOwnerName from "@/actions/userTag/fetchTagAvailability/queries/selectTagOwnerName";
import ZIKTAGS from "@/constants/ziktags";

/** Up to 5 AVAILABLE tags built from the user's name, best first (for onboarding). */
const fetchTagSuggestions = async ({ userId }: { userId: string }) => {
    const user = await selectTagOwnerName({ userId });
    const ideas = [
        ...tagCandidates({ firstName: user?.firstName, lastName: user?.lastName }),
        ...tagCandidates({ firstName: user?.firstName, lastName: user?.lastName }),
    ];
    const unique = [...new Set(ideas)];
    const unavailable = await selectUnavailableTags({ tags: unique, userId });

    return { data: { suggestions: unique.filter((tag) => !unavailable.has(tag)).slice(0, ZIKTAGS.MAX_SUGGESTIONS) } };
};

export default fetchTagSuggestions;
