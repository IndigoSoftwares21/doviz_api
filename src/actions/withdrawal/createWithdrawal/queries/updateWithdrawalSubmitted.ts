import { db } from "@/database";

/** The provider accepted it: keep its reference. */
const updateWithdrawalSubmitted = async ({ id, providerReference }: { id: string; providerReference: string | null }) => {
    const withdrawalRow = await db
        .updateTable("bank_withdrawals")
        .set((eb) => ({ providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)), updatedAt: new Date() }))
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirst();

    return withdrawalRow;
};

export default updateWithdrawalSubmitted;
