import Decimal from "decimal.js";
import { LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

/** Human description of a statement line, e.g. "100 USDT converted to naira". */
const describeStatementEntry = ({
    type,
    symbol,
    cryptoAmount,
}: {
    type: string;
    symbol: string | null;
    cryptoAmount: string | null;
}) => {
    switch (type) {
        case LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT:
            return symbol && cryptoAmount
                ? `${new Decimal(cryptoAmount).toFixed()} ${symbol} converted to naira`
                : "Crypto converted to naira";
        case LEDGER_TRANSACTION_TYPE.WITHDRAWAL_HOLD:
            return "Withdrawal to bank";
        case LEDGER_TRANSACTION_TYPE.WITHDRAWAL_REVERSAL:
            return "Withdrawal refunded";
        default:
            return "Wallet adjustment";
    }
};

export default describeStatementEntry;
