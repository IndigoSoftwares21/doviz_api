import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Still open: note that we checked (updatedAt), and keep the provider's reference if we've just learned it. */
const updateBillPaymentChecked = async ({ trx, id, providerReference }: { trx: Kysely<Database>; id: string; providerReference: string | null }) => {
    const paymentRow = await trx
        .updateTable("bill_payments")
        .set((eb) => ({
            providerReference: eb.fn.coalesce("providerReference", eb.val(providerReference)),
            updatedAt: new Date(),
        }))
        .where("id", "=", id)
        .where("status", "in", ["pending", "processing"])
        .returning(["id"])
        .executeTakeFirst();

    return paymentRow;
};

export default updateBillPaymentChecked;
