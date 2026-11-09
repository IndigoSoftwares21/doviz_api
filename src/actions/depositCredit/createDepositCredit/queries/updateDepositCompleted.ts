import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { ProviderDeposit } from "@/services/crypto/types";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";

interface IUpdateDepositCompleted {
    trx: Kysely<Database>;
    id: string;
    record: ProviderDeposit;
    figures: { grossNgn: string; markupNgn: string; netNgn: string; markupPercent: string; conversionMarkupId: string };
    ledgerTransactionId: string;
}

/** Sets completed in the SAME statement as the credit link (the DB requires both together). */
const updateDepositCompleted = async ({ trx, id, record, figures, ledgerTransactionId }: IUpdateDepositCompleted) => {
    const now = new Date();
    const depositRow = await trx
        .updateTable("crypto_deposits")
        .set({
            status: DEPOSIT_STATUS.COMPLETED,
            subStatus: record.subStatus,
            cryptoAmount: record.cryptoAmount,
            reportedUsd: record.reportedUsd,
            rateNgnPerUsd: record.rateNgnPerUsd,
            txHash: record.txHash,
            senderAddress: record.senderAddress,
            confirmations: record.confirmations,
            amlPassed: record.amlPassed,
            grossNgn: figures.grossNgn,
            markupNgn: figures.markupNgn,
            netNgn: figures.netNgn,
            markupPercent: figures.markupPercent,
            conversionMarkupId: figures.conversionMarkupId,
            ledgerTransactionId,
            lastEventAt: record.occurredAt,
            completedAt: now,
            updatedAt: now,
        })
        .where("id", "=", id)
        .returning(["id", "netNgn"])
        .executeTakeFirstOrThrow();

    return depositRow;
};

export default updateDepositCompleted;
