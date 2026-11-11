import FormatNaira from "@/utils/bills/formatNaira";
import ACTION_FAILURE from "@/constants/actionFailure";
import { CryptoBuyLimits } from "@/actions/cryptoBuyQuote/fetchCryptoBuyQuote";

export const CRYPTO_BUY_MESSAGES = {
    UNAVAILABLE: "Buying crypto is unavailable right now. Please try again shortly.",
    ASSET_UNAVAILABLE: "This coin can't be bought right now. Try another network or check back later.",
    RATE_UNAVAILABLE: "Prices are being updated. Please try again in a few minutes.",
    INVALID_ADDRESS: "That address isn't valid for this network. Check it — crypto sent to a wrong address can't be recovered.",
    QUOTE_CHANGED: "The price changed. Please check the new total and confirm again.",
    INSUFFICIENT_BALANCE: "You don't have enough naira for this purchase.",
} as const;


/**
 * The HTTP answer for a failed quote / purchase (null = not a failure we map
 * here, e.g. PIN, which has its own handler). Messages are the user's words,
 * never a provider's.
 */
const cryptoPurchaseFailureResponse = ({ failure, limits }: { failure: string | null; limits?: CryptoBuyLimits | null }) => {
    switch (failure) {
        case ACTION_FAILURE.PROVIDER_UNAVAILABLE:
        case ACTION_FAILURE.STOCK_UNAVAILABLE:
            return { code: 503, message: CRYPTO_BUY_MESSAGES.UNAVAILABLE };
        case ACTION_FAILURE.RATE_UNAVAILABLE:
            return { code: 503, message: CRYPTO_BUY_MESSAGES.RATE_UNAVAILABLE };
        case ACTION_FAILURE.ASSET_UNAVAILABLE:
            return { code: 400, message: CRYPTO_BUY_MESSAGES.ASSET_UNAVAILABLE };
        case ACTION_FAILURE.INVALID_ADDRESS:
            return { code: 400, message: CRYPTO_BUY_MESSAGES.INVALID_ADDRESS };
        case ACTION_FAILURE.QUOTE_CHANGED:
            return { code: 409, message: CRYPTO_BUY_MESSAGES.QUOTE_CHANGED };
        case ACTION_FAILURE.INSUFFICIENT_BALANCE:
            return { code: 402, message: CRYPTO_BUY_MESSAGES.INSUFFICIENT_BALANCE };
        case ACTION_FAILURE.AMOUNT_OUT_OF_RANGE:
            return limits
                ? {
                      code: 400,
                      message: `Buy at least ${limits.minCrypto} ${limits.symbol} (₦${FormatNaira({ value: limits.minTotal })} minimum), up to ₦${FormatNaira({ value: limits.maxTotal })} at a time.`,
                  }
                : { code: 400, message: CRYPTO_BUY_MESSAGES.ASSET_UNAVAILABLE };
        default:
            return null;
    }
};

export default cryptoPurchaseFailureResponse;
