/**
 * Lowercase words with accents and punctuation removed, so "Adéṣọlá O'Neil-Eze"
 * and "ADESOLA ONEIL EZE" compare equal.
 */
const normalizeName = ({ name }: { name: string }) => {
    const words = name
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^\p{L}\s-]/gu, " ")
        .split(/[\s-]+/)
        .filter(Boolean);

    return words;
};

export default normalizeName;
