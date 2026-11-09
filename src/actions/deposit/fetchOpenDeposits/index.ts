import selectOpenDeposits from "./queries/selectOpenDeposits";

/** Deposits still waiting on the provider (pending/flagged), oldest first. */
const fetchOpenDeposits = async ({ limit = 200 }: { limit?: number } = {}) => {
    const data = await selectOpenDeposits({ limit });

    return { data };
};

export default fetchOpenDeposits;
