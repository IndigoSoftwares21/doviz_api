import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { ProviderSend } from "@/services/cryptoSends/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import selectCryptoPurchaseForUpdate from "@/actions/cryptoPurchaseRefund/createCryptoPurchaseRefund/queries/selectCryptoPurchaseForUpdate";
import updateCryptoPurchaseCompleted from "./queries/updateCryptoPurchaseCompleted";
import insertCryptoSendMovement from "./queries/insertCryptoSendMovement";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { CRYPTO_PURCHASE_STATUS } from "@/constants/cryptoPurchases";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

const FINAL: string[] = [CRYPTO_PURCHASE_STATUS.COMPLETED, CRYPTO_PURCHASE_STATUS.FAILED];

/**
 * Settles a send the provider confirmed, inside the caller's transaction: the
 * held naira becomes Doviz's sale revenue (crypto_sends_in_transit →
 * crypto_sales), and the coin that left (amount + the fee it really charged,
 * else the fee we priced) is recorded against our stock. The user's price is
 * fixed — a different real fee is our margin, never theirs. Does nothing
 * once final. `byOps` when ops resolve a reviewed purchase.
 */
const createCryptoPurchaseSettlement = async ({ trx, purchaseId, record, byOps = false }: { trx: Kysely<Database>; purchaseId: string; record: ProviderSend | null; byOps?: boolean }) => {
    const purchase = await selectCryptoPurchaseForUpdate({ trx, id: purchaseId });
    if (FINAL.includes(purchase.status)) return { data: { settled: false } };

    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `crypto-purchase-settle:${purchase.id}`,
        type: LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_SETTLE,
        description: `${purchase.symbol} purchase sent`,
        currency: purchase.currency,
        metadata: { cryptoPurchaseId: purchase.id, provider: purchase.provider, txHash: record?.txHash ?? null },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.CRYPTO_SENDS_IN_TRANSIT, provider: purchase.provider }, amount: new Decimal(purchase.totalNaira).negated().toFixed(2) },
            { account: { kind: LEDGER_ACCOUNT_KIND.CRYPTO_SALES }, amount: new Decimal(purchase.totalNaira).toFixed(2) },
        ],
    });

    const feeCharged = record?.fee ?? null;
    await updateCryptoPurchaseCompleted({
        trx,
        id: purchase.id,
        ledgerTransactionId: posting.transactionId,
        providerReference: record?.providerReference ?? null,
        providerFeeCharged: feeCharged,
        txHash: record?.txHash ?? null,
    });

    const left = new Decimal(purchase.cryptoAmount).plus(feeCharged ?? purchase.networkFee);
    await insertCryptoSendMovement({ trx, provider: purchase.provider, symbol: purchase.symbol, quantity: left.negated().toFixed(), purchaseId: purchase.id });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.CRYPTO_PURCHASE_COMPLETED,
        actorType: byOps ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.CRYPTO_PURCHASE,
        entityId: purchase.id,
        metadata: { cryptoPurchaseId: purchase.id, provider: purchase.provider, total: purchase.totalNaira, feeCharged, txHash: record?.txHash ?? null },
    });

    await publishUserEvent({ trx, userId: purchase.userId, event: REALTIME_EVENT.CRYPTO_PURCHASE_UPDATED, data: { cryptoPurchaseId: purchase.id, status: CRYPTO_PURCHASE_STATUS.COMPLETED } });

    return { data: { settled: true } };
};

export default createCryptoPurchaseSettlement;
