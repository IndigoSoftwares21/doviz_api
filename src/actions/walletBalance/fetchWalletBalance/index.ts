import CRYPTO from "@/constants/crypto";
import selectUserNairaBalance from "./queries/selectUserNairaBalance";

/** Straight from the ledger — never recomputed from deposits. No account yet = 0.00. */
const fetchWalletBalance = async ({ userId }: { userId: string }) => {
    const account = await selectUserNairaBalance({ userId, currency: CRYPTO.CURRENCY });

    const data = { currency: CRYPTO.CURRENCY, available: account?.balance ?? "0.00" };

    return { data };
};

export default fetchWalletBalance;
