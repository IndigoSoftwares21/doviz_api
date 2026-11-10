import normalizeBillText from "../normalizeBillText";

/** True when `word` (one or more words) appears as whole words in `text`. Both are normalized first. */
const containsBillWord = ({ text, word }: { text: string; word: string }) => {
    const needle = normalizeBillText({ text: word });
    if (!needle) return false;
    return ` ${normalizeBillText({ text })} `.includes(` ${needle} `);
};

export default containsBillWord;
