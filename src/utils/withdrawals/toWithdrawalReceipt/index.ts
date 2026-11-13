import Decimal from "decimal.js";
import WITHDRAWALS from "@/constants/withdrawals";

interface WithdrawalColumns {
    withdrawalId: string | null;
    withdrawalStatus: string | null;
    withdrawalAmount: string | null;
    withdrawalFee: string | null;
    withdrawalFeeReserve: string | null;
    withdrawalFailureReason: string | null;
    withdrawalRequestedAt: Date | null;
    withdrawalFinalizedAt: Date | null;
    withdrawalAccountName: string | null;
    withdrawalAccountNumber: string | null;
    withdrawalBankName: string | null;
    /** Set instead of the account columns for a transfer to someone else's account. */
    withdrawalRecipientName: string | null;
    withdrawalRecipientNumber: string | null;
    withdrawalRecipientBankName: string | null;
    withdrawalNarration: string | null;
}

/**
 * A withdrawal as its receipt shows it: who and where it went, the narration,
 * the money (fee = the real fee once known, else what was reserved), the
 * reference, and when. null when the line isn't a withdrawal.
 */
const toWithdrawalReceipt = (row: WithdrawalColumns) => {
    if (!row.withdrawalId || !row.withdrawalAmount) return null;
    const fee = row.withdrawalFee ?? row.withdrawalFeeReserve ?? "0.00";
    return {
        id: row.withdrawalId,
        reference: row.withdrawalId,
        status: row.withdrawalStatus,
        recipient: {
            name: row.withdrawalAccountName ?? row.withdrawalRecipientName,
            bankName: row.withdrawalBankName ?? row.withdrawalRecipientBankName,
            accountNumber: row.withdrawalAccountNumber ?? row.withdrawalRecipientNumber,
        },
        narration: row.withdrawalNarration ?? WITHDRAWALS.NARRATION,
        amount: new Decimal(row.withdrawalAmount).toFixed(2),
        fee: new Decimal(fee).toFixed(2),
        total: new Decimal(row.withdrawalAmount).plus(fee).toFixed(2),
        failureReason: row.withdrawalFailureReason,
        requestedAt: row.withdrawalRequestedAt,
        completedAt: row.withdrawalFinalizedAt,
    };
};

export default toWithdrawalReceipt;
