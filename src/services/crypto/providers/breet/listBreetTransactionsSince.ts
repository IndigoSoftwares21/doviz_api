import monitoring from "@/utils/monitoring";
import BreetClient from "./breetClient";
import { BreetTransaction } from "./breetTypes";
import BREET from "./constants";

/**
 * Pages Breet's transaction list until a page holds nothing newer than
 * `since` (Breet doesn't document ordering, so check every record).
 */
const listBreetTransactionsSince = async ({ client, since }: { client: BreetClient; since: Date }) => {
    const found: BreetTransaction[] = [];

    for (let page = 1; page <= BREET.MAX_PAGES; page++) {
        const transactions = await client.request<BreetTransaction[]>({
            method: "GET",
            path: "/trades/transactions",
            params: { page, size: BREET.PAGE_SIZE },
        });
        const recent = (transactions ?? []).filter((transaction) => new Date(transaction.updatedAt) >= since);
        found.push(...recent);

        if (!transactions || transactions.length < BREET.PAGE_SIZE || recent.length === 0) return found;
    }

    monitoring.warn(`Breet transaction scan stopped after ${BREET.MAX_PAGES} pages`);
    return found;
};

export default listBreetTransactionsSince;
