import { db } from "@/database";

/** One transfer, only if the viewer is its sender or recipient (no IDOR). */
const selectTransfer = async ({ transferId, viewerId }: { transferId: string; viewerId: string }) => {
    const transferRow = await db
        .selectFrom("internal_transfers")
        .innerJoin("users as sender", "sender.id", "internal_transfers.senderId")
        .innerJoin("users as recipient", "recipient.id", "internal_transfers.recipientId")
        .select([
            "internal_transfers.id",
            "internal_transfers.senderId",
            "internal_transfers.senderTag",
            "internal_transfers.recipientTag",
            "internal_transfers.amount",
            "internal_transfers.currency",
            "internal_transfers.note",
            "internal_transfers.status",
            "internal_transfers.createdAt",
            "sender.firstName as senderFirstName",
            "sender.lastName as senderLastName",
            "recipient.firstName as recipientFirstName",
            "recipient.lastName as recipientLastName",
        ])
        .where("internal_transfers.id", "=", transferId)
        .where((eb) => eb.or([eb("internal_transfers.senderId", "=", viewerId), eb("internal_transfers.recipientId", "=", viewerId)]))
        .executeTakeFirst();

    return transferRow;
};

export default selectTransfer;
