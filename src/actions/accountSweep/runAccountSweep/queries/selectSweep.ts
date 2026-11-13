import { db } from "@/database";

const selectSweep = async ({ id }: { id: string }) => {
    const sweepRow = await db.selectFrom("account_sweeps").select(["id", "provider", "fromAccount", "amount", "reference", "status", "attempts"]).where("id", "=", id).executeTakeFirst();
    return sweepRow ?? null;
};

export default selectSweep;
