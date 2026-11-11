import displayName from "@/utils/transfers/displayName";
import transferDescription from "@/utils/transfers/transferDescription";
import { TRANSFER_DIRECTION } from "@/constants/transfers";

/** The transfer columns a statement row may carry (all null for other lines). */
export interface StatementTransferRow {
    transferId?: string | null;
    transferSenderTag?: string | null;
    transferRecipientTag?: string | null;
    transferNote?: string | null;
    transferSenderFirstName?: string | null;
    transferSenderLastName?: string | null;
    transferRecipientFirstName?: string | null;
    transferRecipientLastName?: string | null;
}

/**
 * A statement line's transfer, from its owner's side: a debit was sent (the
 * counterparty is the recipient), a credit received. Null for other lines.
 */
const toStatementTransfer = ({ row, isDebit }: { row: StatementTransferRow; isDebit: boolean }) => {
    if (!row.transferId) return null;
    const direction = isDebit ? TRANSFER_DIRECTION.SENT : TRANSFER_DIRECTION.RECEIVED;
    const counterpartyTag = (isDebit ? row.transferRecipientTag : row.transferSenderTag) ?? null;
    const counterpartyName = isDebit
        ? displayName({ firstName: row.transferRecipientFirstName ?? null, lastName: row.transferRecipientLastName ?? null })
        : displayName({ firstName: row.transferSenderFirstName ?? null, lastName: row.transferSenderLastName ?? null });

    return {
        direction,
        counterpartyTag,
        counterpartyName,
        note: row.transferNote ?? null,
        description: transferDescription({ direction, counterpartyTag, counterpartyName }),
    };
};

export default toStatementTransfer;
