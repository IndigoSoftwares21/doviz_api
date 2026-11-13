import { Kysely } from "kysely";
import { Database } from "@/database/types";

/** Records the issued account; a racing duplicate (same user/provider, or same number) inserts nothing. */
const insertVirtualAccount = async ({
    trx,
    values,
}: {
    trx: Kysely<Database>;
    values: { userId: string; kycRecordId: string; provider: string; environment: string; customerRef: string; accountNumber: string; accountName: string; bankName: string; bankCode: string | null };
}) => {
    const accountRow = await trx.insertInto("virtual_accounts").values({ ...values, status: "active" }).onConflict((oc) => oc.doNothing()).returning(["id"]).executeTakeFirst();
    return accountRow ?? null;
};

export default insertVirtualAccount;
