import toWithdrawalView from "@/utils/withdrawals/toWithdrawalView";
import selectWithdrawal from "./queries/selectWithdrawal";

/** One of the user's withdrawals, as we have it. Never calls the provider (results arrive by webhook/socket). */
const fetchWithdrawal = async ({ userId, withdrawalId }: { userId: string; withdrawalId: string }) => {
    const row = await selectWithdrawal({ id: withdrawalId, userId });
    if (!row) return { data: null };

    return { data: toWithdrawalView({ row }) };
};

export default fetchWithdrawal;
