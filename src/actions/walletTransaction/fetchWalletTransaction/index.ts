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
        /** A naira top-up by bank transfer: who sent it (masked), when the provider reported it. */
        bankTransfer: row.nairaDepositId
            ? {
                  id: row.nairaDepositId,
                  sender: row.senderName || row.senderBankName || row.senderAccountNumber
                      ? { name: row.senderName, bankName: row.senderBankName, accountNumber: row.senderAccountNumber }
                      : null,
              }
            : null,
    };

    return { data };
};

export default fetchWalletTransaction;
