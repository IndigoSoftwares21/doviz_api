import Decimal from "decimal.js";
import { PayoutProvider } from "@/services/payouts/payoutProvider";
import monitoring from "@/utils/monitoring";

/**
 * True unless the provider says its balance can't cover this payout. A
 * provider that can't report a balance (no API, null, or an error) doesn't
 * block the withdrawal — the provider refusing it later refunds the user.
 */
const checkPayoutFloat = async ({ provider, needed, currency }: { provider: PayoutProvider; needed: string; currency: string }) => {
    if (!provider.getBalance) return true;
    try {
        const balance = await provider.getBalance({ currency });
        if (!balance) return true;
        if (new Decimal(balance.amount).lessThan(needed)) {
            monitoring.error(`Payouts: ${provider.name} ${currency} balance ${balance.amount} can't cover ${needed} — top it up`, new Error("payout float low"));
            return false;
        }
        return true;
    } catch (error) {
        monitoring.warn(`Payouts: couldn't read ${provider.name} balance (${(error as Error).message}) — not blocking`);
        return true;
    }
};

export default checkPayoutFloat;
