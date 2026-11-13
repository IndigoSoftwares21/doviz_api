import monitoring from "@/utils/monitoring";
import withAdvisoryLock from "./withAdvisoryLock";
import sweepWebhookEvents from "./sweepWebhookEvents";
import reconcileDeposits from "./reconcileDeposits";
import reconcileBillPayments from "./reconcileBillPayments";
import reconcileNairaDeposits from "./reconcileNairaDeposits";
import reconcileWithdrawals from "./reconcileWithdrawals";
import reconcileCryptoPurchases from "./reconcileCryptoPurchases";
import sweepAccountDeposits from "./sweepAccountDeposits";

const JOBS = [
    { name: "sweep-webhook-events", lockKey: 7301001, intervalMs: 60_000, run: sweepWebhookEvents },
    { name: "reconcile-deposits", lockKey: 7301002, intervalMs: 10 * 60_000, run: reconcileDeposits },
    { name: "reconcile-bill-payments", lockKey: 7301003, intervalMs: 2 * 60_000, run: reconcileBillPayments },
    { name: "reconcile-naira-deposits", lockKey: 7301004, intervalMs: 2 * 60_000, run: reconcileNairaDeposits },
    { name: "reconcile-withdrawals", lockKey: 7301005, intervalMs: 2 * 60_000, run: reconcileWithdrawals },
    { name: "reconcile-crypto-purchases", lockKey: 7301006, intervalMs: 2 * 60_000, run: reconcileCryptoPurchases },
    { name: "sweep-account-deposits", lockKey: 7301007, intervalMs: 2 * 60_000, run: sweepAccountDeposits },
];

/**
 * Starts background jobs. Called only when the server actually starts (never
 * in tests or on import). Set JOBS_ENABLED=false to run an API instance
 * without jobs. Advisory locks stop instances running a job concurrently;
 * the `running` flag stops overlap within this instance. Errors never crash
 * the process.
 */
const startJobs = () => {
    if (process.env.JOBS_ENABLED === "false") {
        monitoring.info("Background jobs disabled (JOBS_ENABLED=false)");
        return [];
    }

    return JOBS.map((job) => {
        let running = false;
        const tick = async () => {
            if (running) return;
            running = true;
            try {
                await withAdvisoryLock({ key: job.lockKey, job: job.run });
            } catch (error) {
                monitoring.error(`Job ${job.name} failed`, error as Error);
            } finally {
                running = false;
            }
        };
        monitoring.info(`Job ${job.name} scheduled every ${job.intervalMs / 1000}s`);
        return setInterval(tick, job.intervalMs);
    });
};

export default startJobs;
