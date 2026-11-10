import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Still open: note that we checked, and keep the provider's reference if we've just learned it. */
const updateWithdrawalChecked = async ({ trx, id, providerReference }: { trx: Kysely<Database>; id: string; providerReference: string | null }) => {
    const withdrawalRow = await trx
        .updateTable("bank_withdrawals")
        .set((eb) => ({ providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)), updatedAt: new Date() }))
        .where("id", "=", id)
        .where("status", "in", ["pending", "processing"])
        .returning(["id"])
        .executeTakeFirst();

    return withdrawalRow;
};

export default updateWithdrawalChecked;
