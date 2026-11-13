import { db } from "@/database";

/** Sweeps still to do, oldest first. */
const fetchPendingAccountSweeps = async ({ limit }: { limit: number }) => {
    const rows = await db.selectFrom("account_sweeps").select(["id"]).where("status", "=", "pending").orderBy("updatedAt").limit(limit).execute();
    return { data: rows };
};

export default fetchPendingAccountSweeps;
