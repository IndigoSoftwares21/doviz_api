import ZIKTAGS, { ZIKTAG_BLOCKED_WORDS, ZIKTAG_OFFICIAL_AFFIXES, ZIKTAG_REASON, ZIKTAG_RESERVED } from "@/constants/ziktags";

/**
 * Why a NORMALISED tag can't be used, before looking at who has it:
 * "invalid" (format) or "reserved" (exact reserved word, official-sounding
 * start/end, or a blocked word anywhere). null when it's fine.
 */
const tagFormatProblem = ({ tag }: { tag: string }) => {
    if (!ZIKTAGS.FORMAT.test(tag)) return ZIKTAG_REASON.INVALID;
    if (ZIKTAG_RESERVED.has(tag)) return ZIKTAG_REASON.RESERVED;

    const bare = tag.replace(/_/g, "");
    const looksOfficial = ZIKTAG_OFFICIAL_AFFIXES.some((word) => tag.startsWith(word) || tag.endsWith(word) || bare.startsWith(word) || bare.endsWith(word));
    if (looksOfficial) return ZIKTAG_REASON.RESERVED;
    if (ZIKTAG_BLOCKED_WORDS.some((word) => bare.includes(word))) return ZIKTAG_REASON.RESERVED;

    return null;
};

export default tagFormatProblem;
