import displayName from "@/utils/transfers/displayName";
import nameInitials from "@/utils/transfers/nameInitials";

/** What the app shows before paying someone: never a phone number, email or full surname. */
const toRecipientView = ({ row }: { row: { id: string; tag: string | null; firstName: string | null; lastName: string | null } }) => ({
    recipientId: row.id,
    tag: row.tag,
    displayName: displayName(row),
    initials: nameInitials(row),
});

export default toRecipientView;
