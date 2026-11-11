import { Kysely, sql } from "kysely";
import { db } from "@/database";
import { Database } from "@/database/types";
import TRANSFERS, { TRANSFER_STATUS } from "@/constants/transfers";

/** What the user has sent in the last 24 hours (completed transfers), e.g. "360000.00". */
const selectSentInWindow = async ({ trx = db, userId }: { trx?: Kysely<Database>; userId: string }) => {
    const sentRow = await trx
        .selectFrom("internal_transfers")
        .select(sql<string>`coalesce(sum(amount), 0)`.as("sent"))
        .where("senderId", "=", userId)
        .where("currency", "=", TRANSFERS.CURRENCY)
        .where("status", "=", TRANSFER_STATUS.COMPLETED)
        .where("createdAt", ">", sql<Date>`now() - make_interval(hours => ${TRANSFERS.DAILY_WINDOW_HOURS})`)
        .executeTakeFirstOrThrow();

    return sentRow.sent;
};

export default selectSentInWindow;
