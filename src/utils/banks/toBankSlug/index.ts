/** "United Bank For Africa" / "united_bank-for africa" → "united-bank-for-africa" (max 64 chars). */
const toBankSlug = ({ value }: { value: string }) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64)
        .replace(/-+$/, "");

export default toBankSlug;
