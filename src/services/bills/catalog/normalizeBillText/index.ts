/**
 * Uppercase, punctuation → spaces, single spaces. Makes any provider's raw
 * names comparable: "IKEDC  PREPAID", "ikedc-prepaid" → "IKEDC PREPAID".
 * Dots inside numbers survive ("1.5GB").
 */
const normalizeBillText = ({ text }: { text: string }) =>
    text
        .toUpperCase()
        .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
        .replace(/[^A-Z0-9.]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

export default normalizeBillText;
