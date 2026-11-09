import { sql } from "kysely";
import { db } from "@/database";

/**
 * Runs `job` only if no other API instance holds the same lock.
 *
 * Session-level lock on ONE pooled connection with NO transaction open: jobs
 * make provider HTTP calls for minutes, and holding a transaction that long
 * would sit "idle in transaction" (keeping an old snapshot alive and risking
 * idle-transaction timeouts). Released in `finally`, and by Postgres if the
 * connection drops. The job's own queries use other pool connections.
 */
const withAdvisoryLock = ({ key, job }: { key: number; job: () => Promise<void> }) => {
    return db.connection().execute(async (connection) => {
        const { rows } = await sql<{ locked: boolean }>`select pg_try_advisory_lock(${key}) as locked`.execute(connection);
        if (!rows[0]?.locked) return false;

        try {
            await job();
            return true;
        } finally {
            await sql`select pg_advisory_unlock(${key})`.execute(connection);
        }
    });
};

export default withAdvisoryLock;
