import { sql } from "kysely";
import { db } from "@/database";
import monitoring from "@/utils/monitoring";
import TRANSFERS from "@/constants/transfers";

/**
 * Sends to many different people in a short window look like an account
 * takeover emptying a balance: alert ops. Never blocks (v1), never throws.
 */
const flagTransferVelocity = async ({ senderId }: { senderId: string }) => {
    try {
        const row = await db
            .selectFrom("internal_transfers")
            .select(sql<string>`count(distinct recipient_id)`.as("recipients"))
            .where("senderId", "=", senderId)
            .where("createdAt", ">", sql<Date>`now() - make_interval(mins => ${TRANSFERS.VELOCITY_WINDOW_MINUTES})`)
            .executeTakeFirstOrThrow();
        if (Number(row.recipients) >= TRANSFERS.VELOCITY_ALERT_RECIPIENTS) {
            monitoring.warn("Transfer velocity: many recipients in a short window", { senderId, recipients: Number(row.recipients) });
        }
    } catch (error) {
        monitoring.warn(`Transfer velocity check failed: ${(error as Error).message}`);
    }
};

export default flagTransferVelocity;
