import Decimal from "decimal.js";
import selectHighestRecentFee from "../../queries/selectHighestRecentFee";
import selectPayoutFeeDefault from "../../queries/selectPayoutFeeDefault";
import WITHDRAWALS from "@/constants/withdrawals";

/**
 * The fee to reserve when the provider can't quote one: the HIGHER of the
 * configured default (fixed + VAT, rounded up to the kobo) and the highest
 * real fee this provider charged us recently. The default covers a provider
 * or environment with no history yet; the history catches a price rise.
 * "0.00" only when neither exists.
 */
const estimatePayoutFee = async ({ provider, environment, currency }: { provider: string; environment: string; currency: string }) => {
    const since = new Date(Date.now() - WITHDRAWALS.FEE_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const [history, configured] = await Promise.all([
        selectHighestRecentFee({ provider, environment, since }),
        selectPayoutFeeDefault({ provider, environment, currency }),
    ]);

    const recent = new Decimal(history?.highestFee ?? 0);
    const standard = configured
        ? new Decimal(configured.fixedFee).times(new Decimal(100).plus(configured.vatPercent)).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_UP)
        : new Decimal(0);

    return Decimal.max(recent, standard).toFixed(2);
};

export default estimatePayoutFee;
