import Decimal from "decimal.js";
import toWithdrawalReceipt from "@/utils/withdrawals/toWithdrawalReceipt";
import toStatementItem from "@/actions/walletTransactions/fetchWalletTransactions/utils/toStatementItem";
import selectStatementEntry from "./queries/selectStatementEntry";

/** A statement line with full conversion details (the schema has confirmed it's the user's). */
const fetchWalletTransaction = async ({ userId, entryId }: { userId: string; entryId: string }) => {
    const row = await selectStatementEntry({ userId, entryId });
    const item = toStatementItem({ row });

    const data = {
        id: item.id,
        type: item.type,
        direction: item.direction,
        amount: item.amount,
        balanceAfter: item.balanceAfter,
        description: item.description,
        createdAt: item.createdAt,
        deposit: item.deposit && {
            id: item.deposit.id,
            symbol: item.deposit.symbol,
            network: item.deposit.network,
            cryptoAmount: item.deposit.cryptoAmount,
            grossNgn: item.deposit.grossNgn,
            markupNgn: item.deposit.markupNgn,
            markupPercent: item.deposit.markupPercent,
            rateNgnPerUsd: row.rateNgnPerUsd,
            txHash: row.txHash,
            confirmations: row.confirmations,
            detectedAt: row.detectedAt,
            completedAt: row.completedAt,
        },
        transfer: item.transfer,
        /**
         * A naira top-up by bank transfer: who sent it (masked), and the money —
         * what they sent, the transfer fee (when the user bore it), what reached the balance.
         */
        bankTransfer: row.nairaDepositId
            ? {
                  id: row.nairaDepositId,
                  amountSent: row.depositAmountReceived,
                  fee: row.depositAmountReceived && row.depositAmountCredited ? new Decimal(row.depositAmountReceived).minus(row.depositAmountCredited).toFixed(2) : null,
                  amountCredited: row.depositAmountCredited,
                  sender: row.senderName || row.senderBankName || row.senderAccountNumber
                      ? { name: row.senderName, bankName: row.senderBankName, accountNumber: row.senderAccountNumber }
                      : null,
              }
            : null,
        bill: item.bill,
        cryptoPurchase: item.cryptoPurchase,
        /** A withdrawal to a bank: the receipt — recipient, bank, narration, amount, fee, total, reference. */
        withdrawal: toWithdrawalReceipt(row),
    };

    return { data };
};

export default fetchWalletTransaction;
