import selectOpenCryptoPurchases from "./queries/selectOpenCryptoPurchases";
import CRYPTO_PURCHASES from "@/constants/cryptoPurchases";

/** Open purchases old enough for the reconciler (the request that made one handles it first). */
const fetchOpenCryptoPurchases = async () => {
    const data = await selectOpenCryptoPurchases({
        requestedBefore: new Date(Date.now() - CRYPTO_PURCHASES.RECONCILE_MIN_AGE_MS),
        limit: CRYPTO_PURCHASES.RECONCILE_BATCH_SIZE,
    });

    return { data };
};

export default fetchOpenCryptoPurchases;
