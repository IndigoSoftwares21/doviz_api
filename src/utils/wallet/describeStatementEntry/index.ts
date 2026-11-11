import Decimal from "decimal.js";
import { LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { BILL_STATEMENT_LABEL } from "@/constants/bills";

/**
 * Human description of a statement line, e.g. "100 USDT converted to naira"
 * or "Airtime purchase". Bills say which kind when the category is known.
 */
const describeStatementEntry = ({
    type,
    symbol,
    cryptoAmount,
    billCategory = null,
}: {
    type: string;
    symbol: string | null;
    cryptoAmount: string | null;
    billCategory?: string | null;
}) => {
    const billLabel = billCategory ? BILL_STATEMENT_LABEL[billCategory] : undefined;
    switch (type) {
        case LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT:
            return symbol && cryptoAmount
                ? `${new Decimal(cryptoAmount).toFixed()} ${symbol} converted to naira`
                : "Crypto converted to naira";
        case LEDGER_TRANSACTION_TYPE.WITHDRAWAL_HOLD:
            return "Withdrawal to bank";
        case LEDGER_TRANSACTION_TYPE.WITHDRAWAL_REVERSAL:
            return "Withdrawal refunded";
        case LEDGER_TRANSACTION_TYPE.WITHDRAWAL_SETTLE:
            return "Withdrawal fee adjustment";
        case LEDGER_TRANSACTION_TYPE.BILL_HOLD:
            return billLabel?.purchase ?? "Bill payment";
        case LEDGER_TRANSACTION_TYPE.BILL_REVERSAL:
            return billLabel?.refund ?? "Bill payment refunded";
        case LEDGER_TRANSACTION_TYPE.NAIRA_DEPOSIT:
            return "Bank transfer deposit";
        case LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_HOLD:
            return "Crypto purchase";
        case LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_REVERSAL:
            return "Crypto purchase refunded";
        case LEDGER_TRANSACTION_TYPE.INTERNAL_TRANSFER:
            return "Ziks transfer";
        default:
            return "Wallet adjustment";
    }
};

export default describeStatementEntry;
