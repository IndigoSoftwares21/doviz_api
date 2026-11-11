import { withTransaction } from "@/database";
import cryptoSendProviderRegistry from "@/services/cryptoSends/cryptoSendProviderRegistry";
import createCryptoPurchaseSettlement from "@/actions/cryptoPurchaseSettlement/createCryptoPurchaseSettlement";
import createCryptoPurchaseRefund from "@/actions/cryptoPurchaseRefund/createCryptoPurchaseRefund";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import monitoring from "@/utils/monitoring";
import selectCryptoPurchaseForSync from "./queries/selectCryptoPurchaseForSync";
import updateCryptoPurchaseChecked from "./queries/updateCryptoPurchaseChecked";
import updateCryptoPurchaseNeedsReview from "./queries/updateCryptoPurchaseNeedsReview";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import CRYPTO_PURCHASES, { CRYPTO_PURCHASE_STATUS, CRYPTO_PURCHASE_SYNC_OUTCOME, CryptoPurchaseSyncOutcome, PROVIDER_SEND_STATUS } from "@/constants/cryptoPurchases";

const FINAL: string[] = [CRYPTO_PURCHASE_STATUS.COMPLETED, CRYPTO_PURCHASE_STATUS.FAILED];
const FAILED_REASON = "Your crypto couldn't be sent. Your naira has been returned.";

/**
 * Brings one purchase in line with ITS provider's record (the provider on the
 * row — never the active one). Safe to call any number of times: settle and
 * refund lock the row and do nothing once final.
 *   completed → settled    failed → refunded
 *   pending   → keep waiting
 *   not found / unclear for too long → needs_review. NEVER refunded on a
 *   guess: the coin may have left and crypto can't be pulled back. A purchase
 *   in review is still checked, so a late answer resolves it.
 */
const syncCryptoPurchase = async ({ purchaseId }: { purchaseId: string }) => {
    const purchase = await selectCryptoPurchaseForSync({ id: purchaseId });
    if (!purchase) throw new Error(`Crypto purchase ${purchaseId} not found`);
    if (FINAL.includes(purchase.status)) return { data: { outcome: CRYPTO_PURCHASE_SYNC_OUTCOME.UNCHANGED as CryptoPurchaseSyncOutcome } };

    const record = await cryptoSendProviderRegistry
        .get({ name: purchase.provider })
        .getSend({ externalId: purchase.id, providerReference: purchase.providerReference, providerAssetId: purchase.providerAssetId });

    const outcome = await withTransaction(async (trx): Promise<CryptoPurchaseSyncOutcome> => {
        if (record?.status === PROVIDER_SEND_STATUS.COMPLETED) {
            const { data } = await createCryptoPurchaseSettlement({ trx, purchaseId: purchase.id, record });
            return data.settled ? CRYPTO_PURCHASE_SYNC_OUTCOME.COMPLETED : CRYPTO_PURCHASE_SYNC_OUTCOME.UNCHANGED;
        }

        if (record?.status === PROVIDER_SEND_STATUS.FAILED) {
            const { data } = await createCryptoPurchaseRefund({ trx, purchaseId: purchase.id, reason: FAILED_REASON });
            return data.refunded ? CRYPTO_PURCHASE_SYNC_OUTCOME.REFUNDED : CRYPTO_PURCHASE_SYNC_OUTCOME.UNCHANGED;
        }

        await updateCryptoPurchaseChecked({ trx, id: purchase.id, providerReference: record?.providerReference ?? null });

        const overdue = Date.now() - purchase.requestedAt.getTime() > CRYPTO_PURCHASES.REVIEW_AFTER_MS;
        const unclear = !record || purchase.status === CRYPTO_PURCHASE_STATUS.PROCESSING;
        if (overdue && unclear) {
            const flagged = await updateCryptoPurchaseNeedsReview({ trx, id: purchase.id });
            if (!flagged) return CRYPTO_PURCHASE_SYNC_OUTCOME.UNCHANGED;
            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.CRYPTO_PURCHASE_NEEDS_REVIEW,
                actorType: AUDIT_ACTOR_TYPE.SYSTEM,
                entityType: AUDIT_ENTITY_TYPE.CRYPTO_PURCHASE,
                entityId: purchase.id,
                metadata: { cryptoPurchaseId: purchase.id, provider: purchase.provider, providerReference: purchase.providerReference, foundAtProvider: Boolean(record) },
            });
            await publishUserEvent({ trx, userId: flagged.userId, event: REALTIME_EVENT.CRYPTO_PURCHASE_UPDATED, data: { cryptoPurchaseId: purchase.id, status: CRYPTO_PURCHASE_STATUS.NEEDS_REVIEW } });
            return CRYPTO_PURCHASE_SYNC_OUTCOME.NEEDS_REVIEW;
        }

        return purchase.status === CRYPTO_PURCHASE_STATUS.NEEDS_REVIEW ? CRYPTO_PURCHASE_SYNC_OUTCOME.UNCHANGED : CRYPTO_PURCHASE_SYNC_OUTCOME.PENDING;
    });

    if (outcome === CRYPTO_PURCHASE_SYNC_OUTCOME.NEEDS_REVIEW) {
        monitoring.error(`Crypto purchase ${purchase.id} (${purchase.provider}): send outcome unknown — needs review`, new Error("crypto purchase needs review"));
    }

    return { data: { outcome } };
};

export default syncCryptoPurchase;
