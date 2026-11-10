export interface NairaDepositRow {
    id: string;
    status: string;
    currency: string;
    amount: string;
    feeBearer: string;
    fee: string | null;
    amountToTransfer: string | null;
    amountCredited: string | null;
    accountName: string | null;
    accountNumber: string | null;
    bankName: string | null;
    expiresAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
    finalizedAt: Date | null;
}

/**
 * A naira deposit as the app sees it: Doviz ids only, never the provider.
 * The account is shown while it can still be paid (pending); after that only
 * the outcome matters.
 */
const toNairaDepositView = ({ row }: { row: NairaDepositRow }) => ({
    id: row.id,
    status: row.status,
    currency: row.currency,
    amount: row.amount,
    fee: row.fee,
    feeBearer: row.feeBearer,
    amountToTransfer: row.amountToTransfer,
    amountCredited: row.amountCredited,
    bankAccount:
        row.status === "pending" && row.accountNumber
            ? { accountName: row.accountName, accountNumber: row.accountNumber, bankName: row.bankName }
            : null,
    expiresAt: row.expiresAt,
    /** From the server's clock, so the app's countdown is right even if the phone's clock isn't. */
    expiresInSeconds: row.status === "pending" && row.expiresAt ? Math.max(0, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000)) : 0,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    completedAt: row.finalizedAt,
});

export default toNairaDepositView;
