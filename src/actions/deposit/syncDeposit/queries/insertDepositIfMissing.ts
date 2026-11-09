import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";

interface IInsertDepositIfMissing {
    trx: Kysely<Database>;
    provider: string;
    reference: string;
    walletId: string;
    userId: string;
    assetId: string;
    cryptoAmount: string;
}

/** First sighting creates the row as pending; concurrent callers can't duplicate it. */
const insertDepositIfMissing = async ({ trx, provider, reference, walletId, userId, assetId, cryptoAmount }: IInsertDepositIfMissing) => {
    await trx
        .insertInto("crypto_deposits")
        .values({
            provider,
            providerReference: reference,
            walletId,
            userId,
            assetId,
            status: DEPOSIT_STATUS.PENDING,
            subStatus: null,
            cryptoAmount,
            reportedUsd: null,
            rateNgnPerUsd: null,
            grossNgn: null,
            conversionMarkupId: null,
            markupPercent: null,
            markupNgn: null,
            netNgn: null,
            ledgerTransactionId: null,
            txHash: null,
            senderAddress: null,
            confirmations: null,
            amlPassed: null,
            lastEventAt: null,
            completedAt: null,
        })
        .onConflict((oc) => oc.columns(["provider", "providerReference"]).doNothing())
        .execute();
};

export default insertDepositIfMissing;
