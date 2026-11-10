import toNairaDepositView from "@/utils/nairaDeposits/toNairaDepositView";
import selectNairaDeposit from "./queries/selectNairaDeposit";

/**
 * One of the user's naira deposits, as we have it. Never calls the provider:
 * completion comes from the webhook and the reconciler, and is pushed to the
 * app over the socket.
 */
const fetchNairaDeposit = async ({ userId, nairaDepositId }: { userId: string; nairaDepositId: string }) => {
    const row = await selectNairaDeposit({ id: nairaDepositId, userId });
    if (!row) return { data: null };

    return { data: toNairaDepositView({ row }) };
};

export default fetchNairaDeposit;
