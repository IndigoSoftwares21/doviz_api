import { TRANSFER_DIRECTION, TransferDirection } from "@/constants/transfers";

/** "Sent to @ada" / "Received from @tunde" (the name if the sender had no Ziktag). */
const transferDescription = ({
    direction,
    counterpartyTag,
    counterpartyName,
}: {
    direction: TransferDirection;
    counterpartyTag: string | null;
    counterpartyName: string;
}) => {
    const who = counterpartyTag ? `@${counterpartyTag}` : counterpartyName || "a Ziks user";
    return direction === TRANSFER_DIRECTION.SENT ? `Sent to ${who}` : `Received from ${who}`;
};

export default transferDescription;
