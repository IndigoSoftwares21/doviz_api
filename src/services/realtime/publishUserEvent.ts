import { Kysely, sql } from "kysely";
import { Database } from "@/database/types";
import REALTIME, { RealtimeEvent } from "@/constants/realtime";

/**
 * Queues a push to one user's connected devices. Call it with the caller's
 * transaction: Postgres delivers NOTIFY only on COMMIT, so the app is never
 * told about a change that rolled back. Payloads stay small (ids/status
 * only — Postgres caps them at 8KB); the app fetches details over HTTP.
 */
const publishUserEvent = async ({
    trx,
    userId,
    event,
    data = {},
}: {
    trx: Kysely<Database>;
    userId: string;
    event: RealtimeEvent;
    data?: Record<string, string | number | boolean | null>;
}) => {
    const payload = JSON.stringify({ userId, event, data });
    await sql`SELECT pg_notify(${REALTIME.CHANNEL}, ${payload})`.execute(trx);
};

export default publishUserEvent;
