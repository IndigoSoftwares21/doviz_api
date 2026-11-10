import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Row lock: a webhook, the reconciler and a status read can't settle or refund the same payment twice. */
const selectRefundPaymentForUpdate = async ({ trx, id }: { trx: Kysely<Database>; id: string }) => {
    const paymentRow = await trx
        .selectFrom("bill_payments")
        .select(["id", "userId", "provider", "status", "currency", "total"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirstOrThrow();

    return paymentRow;
};

export default selectRefundPaymentForUpdate;
