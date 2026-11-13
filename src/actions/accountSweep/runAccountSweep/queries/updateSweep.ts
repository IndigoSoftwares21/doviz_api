import { db } from "@/database";

const updateSweep = async ({ id, status, attempts, lastError }: { id: string; status: "pending" | "completed" | "failed"; attempts: number; lastError: string | null }) => {
    const now = new Date();
    await db
        .updateTable("account_sweeps")
        .set({ status, attempts, lastError: lastError?.slice(0, 500) ?? null, updatedAt: now, completedAt: status === "completed" ? now : null })
        .where("id", "=", id)
        .where("status", "=", "pending")
        .execute();
};

export default updateSweep;
