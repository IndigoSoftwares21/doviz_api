import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import selectCryptoPurchaseForUpdate from "./queries/selectCryptoPurchaseForUpdate";
import updateCryptoPurchaseFailed from "./queries/updateCryptoPurchaseFailed";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { CRYPTO_PURCHASE_STATUS } from "@/constants/cryptoPurchases";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

const FINAL: string[] = [CRYPTO_PURCHASE_STATUS.COMPLETED, CRYPTO_PURCHASE_STATUS.FAILED];

/**
 * Returns the whole naira total to the user, inside the caller's transaction.
 * ONLY for sends the provider definitely didn't make (it refused, or its own
 * record says failed) — or an ops decision after review (`byOps`). `reason` is shown to
 * the user. Does nothing once final.
 */
const createCryptoPurchaseRefund = async ({ trx, purchaseId, reason, byOps = false }: { trx: Kysely<Database>; purchaseId: string; reason: string; byOps?: boolean }) => {
    const purchase = await selectCryptoPurchaseForUpdate({ trx, id: purchaseId });
    if (FINAL.includes(purchase.status)) return { data: { refunded: false } };

    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `crypto-purchase-refund:${purchase.id}`,
        type: LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_REVERSAL,
        description: `${purchase.symbol} purchase refunded`,
        currency: purchase.currency,
        metadata: { cryptoPurchaseId: purchase.id, provider: purchase.provider, reason },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.CRYPTO_SENDS_IN_TRANSIT, provider: purchase.provider }, amount: new Decimal(purchase.totalNaira).negated().toFixed(2) },
            { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: purchase.userId }, amount: new Decimal(purchase.totalNaira).toFixed(2) },
        ],
    });

    await updateCryptoPurchaseFailed({ trx, id: purchase.id, failureReason: reason, ledgerTransactionId: posting.transactionId });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.CRYPTO_PURCHASE_REFUNDED,
        actorType: byOps ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.CRYPTO_PURCHASE,
        entityId: purchase.id,
        metadata: { cryptoPurchaseId: purchase.id, provider: purchase.provider, total: purchase.totalNaira, reason },
    });

    await publishUserEvent({ trx, userId: purchase.userId, event: REALTIME_EVENT.CRYPTO_PURCHASE_UPDATED, data: { cryptoPurchaseId: purchase.id, status: CRYPTO_PURCHASE_STATUS.FAILED } });
    await publishUserEvent({ trx, userId: purchase.userId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });

    return { data: { refunded: true } };
};

export default createCryptoPurchaseRefund;
