import toRecipientView from "@/utils/transfers/toRecipientView";
import selectRecipientByTag from "./queries/selectRecipientByTag";

/** Exact-match lookup by Ziktag (already normalised): no search, no partial matches. */
const fetchTransferRecipient = async ({ tag, viewerId }: { tag: string; viewerId: string }) => {
    const row = await selectRecipientByTag({ tag, viewerId });
    const data = row ? toRecipientView({ row }) : null;

    return { data };
};

export default fetchTransferRecipient;
