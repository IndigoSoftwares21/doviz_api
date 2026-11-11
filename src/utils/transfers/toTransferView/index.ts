import Decimal from "decimal.js";
import displayName from "@/utils/transfers/displayName";
import nameInitials from "@/utils/transfers/nameInitials";
import transferReference from "@/utils/transfers/transferReference";
import { TRANSFER_DIRECTION } from "@/constants/transfers";

export interface TransferRow {
    id: string;
    senderId: string;
    senderTag: string | null;
    recipientTag: string;
    amount: string;
    currency: string;
    note: string | null;
    status: string;
    createdAt: Date;
    senderFirstName: string | null;
    senderLastName: string | null;
    recipientFirstName: string | null;
    recipientLastName: string | null;
}

/** The API's transfer, from the viewer's side: the other person is the counterparty. */
const toTransferView = ({ row, viewerId }: { row: TransferRow; viewerId: string }) => {
    const sent = row.senderId === viewerId;
    const names = sent
        ? { firstName: row.recipientFirstName, lastName: row.recipientLastName }
        : { firstName: row.senderFirstName, lastName: row.senderLastName };

    return {
        id: row.id,
        amount: new Decimal(row.amount).toFixed(2),
        currency: row.currency,
        note: row.note,
        status: row.status,
        direction: sent ? TRANSFER_DIRECTION.SENT : TRANSFER_DIRECTION.RECEIVED,
        counterparty: {
            tag: sent ? row.recipientTag : row.senderTag,
            displayName: displayName(names),
            initials: nameInitials(names),
        },
        reference: transferReference({ id: row.id }),
        createdAt: row.createdAt,
    };
};

export default toTransferView;
