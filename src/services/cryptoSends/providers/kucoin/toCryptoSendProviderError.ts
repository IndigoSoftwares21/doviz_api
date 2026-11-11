import { CRYPTO_SEND_ERROR_CODE, CryptoSendErrorCode } from "@/constants/cryptoPurchases";
import CryptoSendProviderError from "../../cryptoSendProviderError";

/**
 * KuCoin business codes → our neutral codes. Only 260325 is from KuCoin's
 * docs (address not on the withdrawal whitelist). The rest are ASSUMED from
 * KuCoin's general error list — the withdrawal error page wasn't read — so
 * anything unlisted falls back to the HTTP status / message rules below.
 */
const CODE_CATEGORY: Record<string, CryptoSendErrorCode> = {
    "260325": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // documented: not a favourite (whitelisted) address
    "400001": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: missing auth headers
    "400002": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: timestamp out of window
    "400003": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: API key not found
    "400004": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: bad passphrase
    "400005": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: bad signature
    "400006": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: IP not allowed
    "400007": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: key lacks permission
    "411100": CRYPTO_SEND_ERROR_CODE.CONFIGURATION, // assumed: user frozen
    "200004": CRYPTO_SEND_ERROR_CODE.REJECTED, // assumed: balance insufficient
    "260100": CRYPTO_SEND_ERROR_CODE.REJECTED, // assumed: withdrawals suspended for this coin
    "260200": CRYPTO_SEND_ERROR_CODE.REJECTED, // assumed: invalid address / below minimum
    "400100": CRYPTO_SEND_ERROR_CODE.REJECTED, // assumed: parameter error (e.g. amount precision)
};

const CONFIGURATION_MESSAGE = /whitelist|favorite address|permission|api key|passphrase|signature|\bip\b/i;
const REJECTED_MESSAGE = /insufficient|balance|disabled|suspend|invalid address|minimum|too small|precision/i;

/** One place that decides what a KuCoin failure means for our money. */
const toCryptoSendProviderError = ({ httpStatus, code, message }: { httpStatus: number | null; code: string | null; message: string | null }) => {
    const make = (category: CryptoSendErrorCode) => new CryptoSendProviderError({ code: category, status: httpStatus, providerMessage: message ? `${message}${code ? ` (${code})` : ""}` : code });

    if (httpStatus === null || httpStatus === 429 || httpStatus >= 500) return make(CRYPTO_SEND_ERROR_CODE.UNAVAILABLE);
    if (code && CODE_CATEGORY[code]) return make(CODE_CATEGORY[code]);
    if (httpStatus === 404 || /not found|not exist/i.test(message ?? "")) return make(CRYPTO_SEND_ERROR_CODE.NOT_FOUND);
    if (httpStatus === 401 || httpStatus === 403 || CONFIGURATION_MESSAGE.test(message ?? "")) return make(CRYPTO_SEND_ERROR_CODE.CONFIGURATION);
    if (REJECTED_MESSAGE.test(message ?? "") || (httpStatus >= 400 && httpStatus < 500)) return make(CRYPTO_SEND_ERROR_CODE.REJECTED);
    return make(CRYPTO_SEND_ERROR_CODE.INVALID_RESPONSE);
};

export default toCryptoSendProviderError;
