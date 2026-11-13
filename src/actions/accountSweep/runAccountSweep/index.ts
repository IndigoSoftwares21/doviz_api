import getVirtualAccountProvider from "@/services/virtualAccounts/getVirtualAccountProvider";
import monitoring from "@/utils/monitoring";
import selectSweep from "./queries/selectSweep";
import updateSweep from "./queries/updateSweep";

export const MAX_SWEEP_ATTEMPTS = 10;

/**
 * Tries to move one credited deposit into the pool. Safe to run any number of
 * times: the provider sees the same reference. After MAX_SWEEP_ATTEMPTS it's
 * marked failed and flagged — the user's balance is unaffected either way.
 */
const runAccountSweep = async ({ id }: { id: string }) => {
    const sweep = await selectSweep({ id });
    if (!sweep || sweep.status !== "pending") return { data: { status: sweep?.status ?? "missing" } };

    const provider = getVirtualAccountProvider({ name: sweep.provider });
    const attempts = sweep.attempts + 1;
    try {
        if (!provider.sweepToPool) throw new Error(`${provider.name} has no pool to sweep into`);
        await provider.sweepToPool({ fromAccount: sweep.fromAccount, amount: sweep.amount, reference: sweep.reference });
        await updateSweep({ id, status: "completed", attempts, lastError: null });
        return { data: { status: "completed" } };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = attempts >= MAX_SWEEP_ATTEMPTS ? "failed" : "pending";
        await updateSweep({ id, status, attempts, lastError: message });
        if (status === "failed") monitoring.error(`Sweep ${id} (${sweep.provider}) failed ${attempts} times — money is still in the user's wallet; move it by hand`, error as Error);
        return { data: { status } };
    }
};

export default runAccountSweep;
