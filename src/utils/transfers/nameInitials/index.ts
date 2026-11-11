/** "AO" for Ada Okafor (for the avatar). */
const nameInitials = ({ firstName, lastName }: { firstName: string | null; lastName: string | null }) =>
    [firstName, lastName]
        .map((part) => part?.trim().charAt(0).toUpperCase() ?? "")
        .join("");

export default nameInitials;
