import maskAccountNumber from "@/utils/banks/maskAccountNumber";

export interface WithdrawalRow {
    id: string;
    status: string;
    currency: string;
    amount: string;
    fee: string | null;
    feeReserve: string;
    totalHeld: string;
    failureReason: string | null;
    requestedAt: Date;
    finalizedAt: Date | null;
    narration: string | null;
    /** null for a transfer to someone else's account. */
    bankAccountId: string | null;
    accountNumber: string | null;
    accountName: string | null;
    bankName: string | null;
}

/**
 * A withdrawal as the app sees it: the bank (masked), what's being sent, and
 * the fee — the real one once completed, else the reserve held to cover it.
 * Never a provider name or code.
 */
const toWithdrawalView = ({ row }: { row: WithdrawalRow }) => ({
    id: row.id,
    status: row.status,
    // Own account: masked, as in the account list. Someone else's: in full (it's their receipt to share).
    bankAccount: {
        id: row.bankAccountId,
        bankName: row.bankName,
        accountNumber: row.bankAccountId && row.accountNumber ? maskAccountNumber({ accountNumber: row.accountNumber }) : row.accountNumber,
        accountName: row.accountName,
    },
    toSomeoneElse: row.bankAccountId === null,
    narration: row.narration,
    currency: row.currency,
    amount: row.amount,
    /** The real fee, once completed. */
    fee: row.status === "completed" ? row.fee : null,
    /** Held to cover the fee; any unused part is returned at completion. */
    feeReserve: row.feeReserve,
    totalHeld: row.totalHeld,
    failureReason: row.failureReason,
    createdAt: row.requestedAt,
    completedAt: row.finalizedAt,
});

export default toWithdrawalView;
