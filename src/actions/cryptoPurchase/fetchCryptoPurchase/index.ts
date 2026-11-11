import toCryptoPurchaseView from "@/utils/cryptoPurchases/toCryptoPurchaseView";
import selectCryptoPurchase from "./queries/selectCryptoPurchase";

/** One of the user's purchases, as we have it. Never calls the provider (results arrive by push). */
const fetchCryptoPurchase = async ({ userId, purchaseId }: { userId: string; purchaseId: string }) => {
    const row = await selectCryptoPurchase({ id: purchaseId, userId });
    if (!row) return { data: null };

    return { data: toCryptoPurchaseView({ row }) };
};

export default fetchCryptoPurchase;
