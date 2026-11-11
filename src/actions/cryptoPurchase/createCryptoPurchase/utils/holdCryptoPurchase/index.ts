import Decimal from "decimal.js";
import { withTransaction } from "@/database";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchCryptoBuyQuote from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import insertCryptoPurchase from "../../queries/insertCryptoPurchase";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

type BuyQuote = NonNullable<Awaited<ReturnType<typeof fetchCryptoBuyQuote>>["data"]>;

interface IHoldCryptoPurchase {
    id: string;
    userId: string;
    quote: BuyQuote;
    address: string;
    memo: string | null;
    idempotencyKey: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * One transaction: hold the naira total (user → crypto_sends_in_transit; the
 * ledger refuses an overdraft), record the purchase with its provider and
 * price, audit it, and tell the app the balance changed. Throws on an
 * overdraft or an idempotency race — the caller maps those.
 */
const holdCryptoPurchase = ({ id, userId, quote, address, memo, idempotencyKey, ipAddress, userAgent }: IHoldCryptoPurchase) =>
    withTransaction(async (trx) => {
        const { provider } = quote;
        const { data: hold } = await createLedgerPosting({
            trx,
            idempotencyKey: `crypto-purchase-hold:${id}`,
            type: LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_HOLD,
            description: `Buy ${quote.asset.symbol} (${quote.asset.network})`.slice(0, 255),
            currency: quote.currency,
            metadata: { cryptoPurchaseId: id, provider: provider.name, assetId: quote.asset.id, cryptoAmount: quote.cryptoAmount, rateId: quote.rateId },
            entries: [
                { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, amount: new Decimal(quote.total).negated().toFixed(2) },
                { account: { kind: LEDGER_ACCOUNT_KIND.CRYPTO_SENDS_IN_TRANSIT, provider: provider.name }, amount: quote.total },
            ],
        });

        await insertCryptoPurchase({
            trx,
            id,
            userId,
            assetId: quote.asset.id,
            provider: provider.name,
            environment: provider.environment,
            providerAssetId: quote.providerAssetId,
            idempotencyKey,
            address,
            memo,
            cryptoAmount: quote.cryptoAmount,
            networkFee: quote.networkFee,
            rateId: quote.rateId,
            priceSource: quote.priceSource,
            marketPriceUsdt: quote.marketPriceUsdt,
            markupPercent: quote.markupPercent,
            unitPrice: quote.unitPrice,
            currency: quote.currency,
            nairaAmount: quote.nairaAmount,
            nairaFee: quote.nairaFee,
            totalNaira: quote.total,
            holdLedgerTransactionId: hold.transactionId,
        });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.CRYPTO_PURCHASE_REQUESTED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.CRYPTO_PURCHASE,
            entityId: id,
            ipAddress,
            userAgent,
            metadata: {
                cryptoPurchaseId: id,
                assetId: quote.asset.id,
                cryptoAmount: quote.cryptoAmount,
                total: quote.total,
                rateId: quote.rateId,
                priceSource: quote.priceSource,
                marketPriceUsdt: quote.marketPriceUsdt,
                markupPercent: quote.markupPercent,
                provider: provider.name,
            },
        });

        await publishUserEvent({ trx, userId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });
    });

export type { BuyQuote };

export default holdCryptoPurchase;
