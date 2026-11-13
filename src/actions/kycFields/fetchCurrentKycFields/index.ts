import { Kysely } from "kysely";
import { Database } from "@/database/types";
import selectCurrentKycFields from "./queries/selectCurrentKycFields";

/**
 * What KYC data a user already has on file, by field key — so any feature
 * (a new form, an upgrade, a provider) can reuse it instead of asking again.
 * Values stay encrypted; only ids and safe display hints come back.
 */
const fetchCurrentKycFields = async ({ userId, trx }: { userId: string; trx?: Kysely<Database> }) => {
    const rows = await selectCurrentKycFields({ userId, trx });
    return { data: new Map(rows.map((row) => [row.fieldKey, row])) };
};

export default fetchCurrentKycFields;
