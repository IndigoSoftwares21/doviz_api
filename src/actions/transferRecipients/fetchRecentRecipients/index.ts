import toRecipientView from "@/utils/transfers/toRecipientView";
import selectRecentRecipients from "./queries/selectRecentRecipients";

/** Up to 10 people this user recently sent to, for one-tap repeat sends. */
const fetchRecentRecipients = async ({ userId }: { userId: string }) => {
    const rows = await selectRecentRecipients({ userId });
    const data = { recipients: rows.map((row) => toRecipientView({ row })) };

    return { data };
};

export default fetchRecentRecipients;
