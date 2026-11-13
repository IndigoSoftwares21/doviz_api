import Decimal from "decimal.js";
import fetchActivePayoutProvider from "@/actions/payoutProvider/fetchActivePayoutProvider";
import resolveDestination, { WithdrawalDestination } from "./utils/resolveDestination";
import estimatePayoutFee from "./utils/estimatePayoutFee";
import ACTION_FAILURE from "@/constants/actionFailure";
import WITHDRAWALS from "@/constants/withdrawals";

/**
 * What a withdrawal will cost, with the provider active RIGHT NOW, to either
 * one of the user's own accounts or anyone's (see resolveDestination). The fee
 * is dynamic and paid by the user: exact when the provider can quote it, else
 * a reserve — the higher of the provider's configured default fee
 * (payout_fee_defaults) and the highest real fee it charged us recently. The
 * real fee is charged at settlement and any unused reserve goes straight back.
 * The app shows this before the PIN, and the server recomputes it on confirm
 * (a change → the user re-confirms).
 */
const fetchWithdrawalQuote = async ({ userId, destination, amount }: { userId: string; destination: WithdrawalDestination; amount: string }) => {
    const { data: provider } = await fetchActivePayoutProvider();
    const resolved = await resolveDestination({ userId, destination, provider });
    if (!resolved.data) return { data: null, failure: resolved.failure, limits: null };

    const money = { amount: new Decimal(amount).toFixed(2), currency: WITHDRAWALS.CURRENCY };
    const { limits } = provider;
    if (limits && (new Decimal(money.amount).lessThan(limits.minAmount) || new Decimal(money.amount).greaterThan(limits.maxAmount))) {
        return { data: null, failure: ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, limits };
    }
    const quoted = provider.quoteFee ? await provider.quoteFee({ amount: money }) : null;
    const fee = quoted?.amount ?? (await estimatePayoutFee({ provider: provider.name, environment: provider.environment, currency: money.currency }));

    const data = {
        provider,
        providerBankId: resolved.data.providerBankId,
        account: resolved.data,
        amount: money.amount,
        currency: money.currency,
        /** Exact fee, or the reserve held to cover it (charged at cost, the rest returned). */
        fee,
        feeIsExact: quoted !== null,
        totalHeld: new Decimal(money.amount).plus(fee).toFixed(2),
    };

    return { data, failure: null, limits: null };
};

export default fetchWithdrawalQuote;
