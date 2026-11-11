import KUCOIN, { KUCOIN_ACCOUNT_MODE, KucoinAccountMode } from "./constants";

export interface KucoinConfig {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
    keyVersion: string;
    accountMode: KucoinAccountMode;
}

/** Reads KuCoin's API key settings from the environment; throws if any is missing. */
const getKucoinConfig = (): KucoinConfig => {
    const apiKey = process.env.KUCOIN_API_KEY;
    const apiSecret = process.env.KUCOIN_API_SECRET;
    const apiPassphrase = process.env.KUCOIN_API_PASSPHRASE;
    if (!apiKey || !apiSecret || !apiPassphrase) {
        throw new Error("KUCOIN_API_KEY, KUCOIN_API_SECRET and KUCOIN_API_PASSPHRASE must all be set");
    }
    const mode = (process.env.KUCOIN_ACCOUNT_MODE ?? KUCOIN_ACCOUNT_MODE.CLASSIC).toLowerCase();
    if (mode !== KUCOIN_ACCOUNT_MODE.CLASSIC && mode !== KUCOIN_ACCOUNT_MODE.UNIFIED) {
        throw new Error(`KUCOIN_ACCOUNT_MODE must be "classic" or "unified", got "${mode}"`);
    }
    return {
        baseUrl: KUCOIN.BASE_URL,
        apiKey,
        apiSecret,
        apiPassphrase,
        keyVersion: process.env.KUCOIN_API_KEY_VERSION ?? KUCOIN.DEFAULT_KEY_VERSION,
        accountMode: mode,
    };
};

export default getKucoinConfig;
