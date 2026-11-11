import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import fetchCryptoPurchase from "@/actions/cryptoPurchase/fetchCryptoPurchase";
import fetchCryptoBuyQuote, { CryptoBuyLimits } from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";
import isInsufficientBalanceError from "@/utils/ledger/isInsufficientBalanceError";
import isValidCryptoAddress from "@/utils/cryptoPurchases/isValidCryptoAddress";
import isFreshQuoteAcceptable from "@/utils/cryptoPurchases/isFreshQuoteAcceptable";
import selectCryptoPurchaseIdByIdempotencyKey from "./queries/selectCryptoPurchaseIdByIdempotencyKey";
import checkCryptoStock from "./utils/checkCryptoStock";
import holdCryptoPurchase from "./utils/holdCryptoPurchase";
import sendCryptoPurchase from "./utils/sendCryptoPurchase";
import isIdempotencyConflictError from "./utils/isIdempotencyConflictError";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";

interface ICreateCryptoPurchase {
    userId: string;
    assetId: string;
    address: string;
    memo: string | null;
    /** One of: the coin to receive … */
    cryptoAmount: string | null;
    /** … or the naira to spend in total. */
    nairaTotal: string | null;
    /** The total the user confirmed. Never charged more than this. */
    expectedTotal: string;
    /** The coin the user saw; lets a moving price go ahead within tolerance (isFreshQuoteAcceptable). */
    expectedCryptoAmount: string | null;
    idempotencyKey: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Buys crypto for the user's own address: PIN → replay → re-quote with the
 * ACTIVE provider and our current price (worse for the user than confirmed →
 * quote_changed, nothing held; see isFreshQuoteAcceptable)
 * → address check → stock check (skipped if the provider can't report one) →
 * hold + record (holdCryptoPurchase) → send (sendCryptoPurchase) → return it.
 * The same idempotency key returns the original.
 */
const createCryptoPurchase = async (input: ICreateCryptoPurchase) => {
    const { userId, idempotencyKey, ipAddress, userAgent } = input;
    const { data: verification } = await createPinVerification({ userId, pin: input.pin, ipAddress, userAgent });
    const result = (fields: { data?: unknown; failure?: string; isNew?: boolean; quote?: unknown; limits?: CryptoBuyLimits | null }) => ({
        data: null, failure: null as string | null, isNew: false, quote: null, limits: null as CryptoBuyLimits | null, verification, ...fields,
    });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return result({ failure: ACTION_FAILURE.PIN });

    const replay = async () => {
        const existing = await selectCryptoPurchaseIdByIdempotencyKey({ userId, idempotencyKey });
        return existing ? result({ data: (await fetchCryptoPurchase({ userId, purchaseId: existing.id })).data }) : null;
    };
    const previous = await replay();
    if (previous) return previous;

    const { data: quote, failure, limits } = await fetchCryptoBuyQuote(input);
    if (!quote) return result({ failure: failure ?? undefined, limits });
    const { provider, ...priced } = quote;
    const summary = { cryptoAmount: priced.cryptoAmount, networkFee: priced.networkFee, unitPrice: priced.unitPrice, nairaAmount: priced.nairaAmount, nairaFee: priced.nairaFee, total: priced.total };
    const acceptable = isFreshQuoteAcceptable({ expectedTotal: input.expectedTotal, expectedCryptoAmount: input.expectedCryptoAmount, fresh: quote });
    if (!acceptable) return result({ failure: ACTION_FAILURE.QUOTE_CHANGED, quote: summary });

    const address = input.address.trim();
    const memo = input.memo?.trim() || null;
    if (!isValidCryptoAddress({ network: quote.asset.network, address }) || (quote.memoRequired && !memo)) return result({ failure: ACTION_FAILURE.INVALID_ADDRESS });

    const needed = new Decimal(quote.cryptoAmount).plus(quote.networkFee).toFixed();
    if (!(await checkCryptoStock({ provider, providerAssetId: quote.providerAssetId, needed }))) return result({ failure: ACTION_FAILURE.STOCK_UNAVAILABLE });

    const id = randomUUID();
    try {
        await holdCryptoPurchase({ id, userId, quote, address, memo, idempotencyKey, ipAddress, userAgent });
    } catch (error) {
        if (isInsufficientBalanceError({ error })) return result({ failure: ACTION_FAILURE.INSUFFICIENT_BALANCE, quote: summary });
        const raced = isIdempotencyConflictError({ error }) ? await replay() : null;
        if (raced) return raced;
        throw error;
    }

    const data = await sendCryptoPurchase({ purchaseId: id, userId, provider: provider.name, providerAssetId: quote.providerAssetId, address, memo, cryptoAmount: quote.cryptoAmount });
    return result({ data, isNew: true });
};

export default createCryptoPurchase;
