/** KuCoin (crypto sends). Values here never leave this folder. */
const KUCOIN = {
    PROVIDER_NAME: "kucoin",
    BASE_URL: "https://api.kucoin.com",
    /** KC-API-KEY-VERSION; override with KUCOIN_API_KEY_VERSION. */
    DEFAULT_KEY_VERSION: "2",
    TIMEOUT_MS: 15_000,
    /** KuCoin's success code in its { code, data } envelope. */
    SUCCESS_CODE: "200000",
    /** Coins we ask KuCoin about in listSendableAssets. */
    SEND_CURRENCIES: ["USDT"],
    /**
     * UNVERIFIED until the first real ~$1 send (NAIRA_TO_CRYPTO_PLAN.md §11).
     * false: KuCoin takes its fee from our balance on top, so the recipient
     * gets `amount` exactly and we send it as-is. If the test shows the fee is
     * deducted from `amount`, set true and the adapter sends amount + fee.
     */
    FEE_INCLUDED_IN_AMOUNT: false,
    /** How many recent withdrawals getSend searches for our remark when it has no KuCoin id. */
    HISTORY_PAGE_SIZE: 100,
} as const;

export const KUCOIN_ACCOUNT_MODE = {
    CLASSIC: "classic",
    UNIFIED: "unified",
} as const;

export type KucoinAccountMode = (typeof KUCOIN_ACCOUNT_MODE)[keyof typeof KUCOIN_ACCOUNT_MODE];

export default KUCOIN;
