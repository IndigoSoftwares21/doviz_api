import fetchCryptoPurchase from "@/actions/cryptoPurchase/fetchCryptoPurchase";
import monitoring from "@/utils/monitoring";
import submitCryptoPurchase from "../submitCryptoPurchase";
import scheduleCryptoPurchaseChecks from "../scheduleCryptoPurchaseChecks";
import CRYPTO_PURCHASES, { CRYPTO_PURCHASE_STATUS } from "@/constants/cryptoPurchases";

const OPEN: string[] = [CRYPTO_PURCHASE_STATUS.PENDING, CRYPTO_PURCHASE_STATUS.PROCESSING];

/**
 * Sends a held purchase, waiting at most SUBMIT_WAIT_MS for the provider (the
 * rest finishes in the background), then returns the purchase as it stands
 * and schedules follow-up checks if it's still open. Anything the submission
 * throws is logged and left to the reconciler — the naira is held, never lost.
 */
const sendCryptoPurchase = async (args: Parameters<typeof submitCryptoPurchase>[0] & { userId: string }) => {
    const { userId, ...send } = args;
    const submission = submitCryptoPurchase(send).catch((error) =>
        monitoring.error(`Crypto purchase ${send.purchaseId}: submission failed — will reconcile`, error as Error),
    );
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([submission, new Promise<void>((resolve) => (timer = setTimeout(resolve, CRYPTO_PURCHASES.SUBMIT_WAIT_MS)))]);
    clearTimeout(timer);

    const { data } = await fetchCryptoPurchase({ userId, purchaseId: send.purchaseId });
    if (data && OPEN.includes(data.status)) scheduleCryptoPurchaseChecks({ purchaseId: send.purchaseId });
    return data;
};

export default sendCryptoPurchase;
