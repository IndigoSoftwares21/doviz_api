import toNairaDepositView from "@/utils/nairaDeposits/toNairaDepositView";
import selectActiveNairaDeposit from "./queries/selectActiveNairaDeposit";

/**
 * The deposit the user is in the middle of, if any — so the app can reopen
 * the account card after a crash, a reinstall or on another device. null
 * when nothing can still be paid into.
 */
const fetchActiveNairaDeposit = async ({ userId }: { userId: string }) => {
    const row = await selectActiveNairaDeposit({ userId, now: new Date() });

    return { data: row ? toNairaDepositView({ row }) : null };
};

export default fetchActiveNairaDeposit;
