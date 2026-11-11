/**
 * "Ada O.": first name and last initial — enough to recognise someone before
 * paying them, without revealing their full name to anyone who knows a tag.
 */
const displayName = ({ firstName, lastName }: { firstName: string | null; lastName: string | null }) => {
    const first = firstName?.trim() ?? "";
    const initial = lastName?.trim().charAt(0).toUpperCase() ?? "";
    return [first, initial ? `${initial}.` : ""].filter(Boolean).join(" ");
};

export default displayName;
