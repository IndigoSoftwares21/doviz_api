import ZIKTAGS from "@/constants/ziktags";
import tagFormatProblem from "../tagFormatProblem";

/** "Adéṣọlá" → "adesola": letters and digits only, accents dropped. */
const slug = (value: string | null | undefined) =>
    (value ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const fit = (value: string) => value.slice(0, ZIKTAGS.MAX_LENGTH).replace(/_+$/, "");

/**
 * Tag ideas from a name, best first, all well-formed and not reserved
 * (availability is checked by the caller): adaokafor, ada_okafor, ada_o,
 * okaforada, then numbered ones. With no usable name: user1234-style ("ziks…" is reserved).
 * `seed` makes the numbers deterministic in tests.
 */
const tagCandidates = ({ firstName, lastName, seed = Math.random }: { firstName?: string | null; lastName?: string | null; seed?: () => number }) => {
    const first = slug(firstName);
    const last = slug(lastName);
    const number = () => String(Math.floor(seed() * 900) + 100);
    const base = first && /^[a-z]/.test(first) ? first : last && /^[a-z]/.test(last) ? last : "";

    const ideas = base
        ? [
              first && last ? `${first}${last}` : base,
              first && last ? `${first}_${last}` : `${base}_ng`,
              first && last ? `${first}_${last[0]}` : `${base}${number()}`,
              first && last ? `${last}${first}` : `${base}_${number()}`,
              `${first && last ? `${first}${last}` : base}${number()}`,
              `${base}_${number()}`,
              `${base}${number()}`,
          ]
        : [`user${number()}${number().slice(0, 1)}`, `user_${number()}${number()}`, `zik_user${number()}`];

    return [...new Set(ideas.map(fit))].filter((tag) => tagFormatProblem({ tag }) === null);
};

export default tagCandidates;
