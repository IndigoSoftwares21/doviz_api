import Decimal from "decimal.js";
import { ENTRY_DIRECTION } from "@/constants/ledger";
import describeStatementEntry from "@/utils/wallet/describeStatementEntry";

interface StatementRow {
    id: string;
    amount: string;
    balanceAfter: string;
    createdAt: Date;
    type: string;
    depositId: string | null;
    symbol: string | null;
    network: string | null;
    cryptoAmount: string | null;
    grossNgn: string | null;
    markupNgn: string | null;
    markupPercent: string | null;
    billPaymentId: string | null;
    billCategory: string | null;
    billerName: string | null;
    billProductName: string | null;
    billCustomerId: string | null;
}

/** One statement line: absolute amount + direction, balance after, and its source (deposit or bill). */
const toStatementItem = ({ row }: { row: StatementRow }) => {
    const amount = new Decimal(row.amount);

    return {
        id: row.id,
        type: row.type,
        direction: amount.isNegative() ? ENTRY_DIRECTION.DEBIT : ENTRY_DIRECTION.CREDIT,
        amount: amount.abs().toFixed(2),
        balanceAfter: new Decimal(row.balanceAfter).toFixed(2),
        description: describeStatementEntry({
            type: row.type,
            symbol: row.symbol,
            cryptoAmount: row.cryptoAmount,
            billCategory: row.billCategory,
        }),
        createdAt: row.createdAt,
        deposit: row.depositId
            ? {
                  id: row.depositId,
                  symbol: row.symbol,
                  network: row.network,
                  cryptoAmount: row.cryptoAmount ? new Decimal(row.cryptoAmount).toFixed() : null,
                  grossNgn: row.grossNgn,
                  markupNgn: row.markupNgn,
                  markupPercent: row.markupPercent,
              }
            : null,
        bill: row.billPaymentId
            ? {
                  id: row.billPaymentId,
                  category: row.billCategory,
                  billerName: row.billerName,
                  productName: row.billProductName,
                  customerId: row.billCustomerId,
              }
            : null,
    };
};

export default toStatementItem;
