import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { SealedKycField } from "../utils/sealSubmittedValues";

/** A new current value for one field: the old row is kept (superseded), never changed. */
const replaceKycField = async ({ trx, field }: { trx: Kysely<Database>; field: SealedKycField }) => {
    await trx
        .updateTable("kyc_fields")
        .set({ supersededAt: new Date() })
        .where("userId", "=", field.userId)
        .where("fieldKey", "=", field.fieldKey)
        .where("supersededAt", "is", null)
        .execute();
    await trx.insertInto("kyc_fields").values(field).execute();
};

export default replaceKycField;
