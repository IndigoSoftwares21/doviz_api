import fetchPendingAccountSweeps from "@/actions/accountSweep/fetchPendingAccountSweeps";
import runAccountSweep from "@/actions/accountSweep/runAccountSweep";

/** Retries moving credited deposits into the pool (master) wallet. */
const sweepAccountDeposits = async () => {
    const { data: sweeps } = await fetchPendingAccountSweeps({ limit: 50 });
    for (const sweep of sweeps) {
        await runAccountSweep({ id: sweep.id });
    }
};

export default sweepAccountDeposits;
