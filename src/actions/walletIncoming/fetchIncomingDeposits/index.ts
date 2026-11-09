import Decimal from "decimal.js";
import selectIncomingDeposits from "./queries/selectIncomingDeposits";

/**
 * Deposits seen on-chain but not yet credited ("confirming", or "flagged"
 * e.g. below the minimum). Shown above the statement; no money has moved.
 */
const fetchIncomingDeposits = async ({ userId }: { userId: string }) => {
    const rows = await selectIncomingDeposits({ userId });

    const data = rows.map((row) => ({
        id: row.id,
        status: row.status,
        subStatus: row.subStatus,
        symbol: row.symbol,
        network: row.network,
        cryptoAmount: new Decimal(row.cryptoAmount).toFixed(),
        confirmations: row.confirmations,
        txHash: row.txHash,
        detectedAt: row.detectedAt,
    }));

    return { data };
};

export default fetchIncomingDeposits;
