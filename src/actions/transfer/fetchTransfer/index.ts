import toTransferView from "@/utils/transfers/toTransferView";
import selectTransfer from "./queries/selectTransfer";

/** A transfer from the viewer's side (direction and counterparty), or null if it isn't theirs. */
const fetchTransfer = async ({ transferId, viewerId }: { transferId: string; viewerId: string }) => {
    const row = await selectTransfer({ transferId, viewerId });
    const data = row ? toTransferView({ row, viewerId }) : null;

    return { data };
};

export default fetchTransfer;
