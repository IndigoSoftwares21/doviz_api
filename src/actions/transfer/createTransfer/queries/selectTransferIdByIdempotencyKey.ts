import { db } from "@/database";

const selectTransferIdByIdempotencyKey = async ({ senderId, idempotencyKey }: { senderId: string; idempotencyKey: string }) => {
    const transferRow = await db
        .selectFrom("internal_transfers")
        .select(["id"])
        .where("senderId", "=", senderId)
        .where("idempotencyKey", "=", idempotencyKey)
        .executeTakeFirst();

    return transferRow;
};

export default selectTransferIdByIdempotencyKey;
