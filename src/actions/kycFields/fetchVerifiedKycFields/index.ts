import { Kysely } from "kysely";
import { Database } from "@/database/types";
import selectVerifiedKycFields from "./queries/selectVerifiedKycFields";

/**
 * What a user has ON FILE: the details their verification in force was checked
 * against, by field key. Only verified details are reused (e.g. for an
 * upgrade); a rejected attempt's values are kept for history but never count
 * as on file — the user enters them again. Values stay encrypted.
 */
const fetchVerifiedKycFields = async ({ userId, trx }: { userId: string; trx?: Kysely<Database> }) => {
    // lookup_index is CHAR(64): the type generator can't name it, so it's typed here.
    const rows = (await selectVerifiedKycFields({ userId, trx })).map((row) => ({ ...row, lookupIndex: row.lookupIndex as string | null }));
    return { data: new Map<string, (typeof rows)[number]>(rows.map((row) => [row.fieldKey, row])) };
};

export default fetchVerifiedKycFields;
