import toNairaDepositView from "@/utils/nairaDeposits/toNairaDepositView";
import selectNairaDeposits from "./queries/selectNairaDeposits";

/** A page of the user's naira deposits, newest first. One extra row is read to know if there's more. */
const fetchNairaDeposits = async ({ userId, limit, offset }: { userId: string; limit: number; offset: number }) => {
    const rows = await selectNairaDeposits({ userId, limit: limit + 1, offset });

    const data = {
        items: rows.slice(0, limit).map((row) => toNairaDepositView({ row })),
        limit,
        offset,
        hasMore: rows.length > limit,
    };

    return { data };
};

export default fetchNairaDeposits;
