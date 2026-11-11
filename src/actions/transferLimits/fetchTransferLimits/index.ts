import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import TRANSFERS from "@/constants/transfers";
import selectTransferLimits from "./queries/selectTransferLimits";
import selectSentInWindow from "./queries/selectSentInWindow";

/**
 * The sending limits and how much of the rolling 24-hour cap is left. Read
 * fresh every time (a change in the database applies to the very next
 * transfer). Pass `trx` to read inside the send transaction.
 */
const fetchTransferLimits = async ({ userId, trx }: { userId: string; trx?: Kysely<Database> }) => {
    const [limits, sent] = await Promise.all([selectTransferLimits({ trx }), selectSentInWindow({ trx, userId })]);
    const sentToday = new Decimal(sent);
    const remaining = Decimal.max(new Decimal(limits.maxPerDay).minus(sentToday), 0);

    const data = {
        currency: TRANSFERS.CURRENCY,
        minAmount: new Decimal(limits.minAmount).toFixed(2),
        maxPerTransfer: new Decimal(limits.maxPerTransfer).toFixed(2),
        maxPerDay: new Decimal(limits.maxPerDay).toFixed(2),
        sentToday: sentToday.toFixed(2),
        remainingToday: remaining.toFixed(2),
    };

    return { data };
};

export default fetchTransferLimits;
