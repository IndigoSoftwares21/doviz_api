import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { ProviderDeposit } from "@/services/crypto/types";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";

/** Non-crediting updates (pending / flagged / deleted). Never sets completed. */
const updateDepositProgress = async ({ trx, id, record }: { trx: Kysely<Database>; id: string; record: ProviderDeposit }) => {
    if (record.status === DEPOSIT_STATUS.COMPLETED) {
        throw new Error("updateDepositProgress must not complete a deposit — use createDepositCredit");
    }

    const depositRow = await trx
        .updateTable("crypto_deposits")
        .set({
            status: record.status,
            subStatus: record.subStatus,
            cryptoAmount: record.cryptoAmount,
            reportedUsd: record.reportedUsd,
            rateNgnPerUsd: record.rateNgnPerUsd,
            txHash: record.txHash,
            senderAddress: record.senderAddress,
            confirmations: record.confirmations,
            amlPassed: record.amlPassed,
            lastEventAt: record.occurredAt,
            updatedAt: new Date(),
        })
        .where("id", "=", id)
        .returning(["id", "status"])
        .executeTakeFirstOrThrow();

    return depositRow;
};

export default updateDepositProgress;
