import Decimal from "decimal.js";
import fetchActivePayoutProvider from "@/actions/payoutProvider/fetchActivePayoutProvider";
import selectQuoteBankAccount from "./queries/selectQuoteBankAccount";
import selectProviderBankId from "./queries/selectProviderBankId";
import selectHighestRecentFee from "./queries/selectHighestRecentFee";
import ACTION_FAILURE from "@/constants/actionFailure";
import WITHDRAWALS from "@/constants/withdrawals";

/**
 * What a withdrawal will cost, with the provider active RIGHT NOW. The fee is
 * dynamic and paid by the user: exact when the provider can quote it, else a
 * reserve — the highest real fee this provider charged us recently (our own
 * records; nothing configured). The real fee is charged at settlement and any
 * unused reserve goes straight back. The app shows this before the PIN, and
 * the server recomputes it on confirm (a change → the user re-confirms).
 */
const fetchWithdrawalQuote = async ({ userId, bankAccountId, amount }: { userId: string; bankAccountId: string; amount: string }) => {
    const { data: provider } = await fetchActivePayoutProvider();
    const account = await selectQuoteBankAccount({ bankAccountId, userId });

    const mapping = await selectProviderBankId({ payoutBankId: account.payoutBankId, provider: provider.name, environment: provider.environment });
    if (!mapping) return { data: null, failure: ACTION_FAILURE.BANK_UNSUPPORTED, limits: null };

    const money = { amount: new Decimal(amount).toFixed(2), currency: WITHDRAWALS.CURRENCY };
    const { limits } = provider;
    if (limits && (new Decimal(money.amount).lessThan(limits.minAmount) || new Decimal(money.amount).greaterThan(limits.maxAmount))) {
        return { data: null, failure: ACTION_FAILURE.AMOUNT_OUT_OF_RANGE, limits };
    }
    const quoted = provider.quoteFee ? await provider.quoteFee({ amount: money }) : null;
    let fee = quoted?.amount ?? null;
    if (fee === null) {
        const since = new Date(Date.now() - WITHDRAWALS.FEE_HISTORY_DAYS * 24 * 60 * 60 * 1000);
        const history = await selectHighestRecentFee({ provider: provider.name, environment: provider.environment, since });
        fee = history?.highestFee ? new Decimal(history.highestFee).toFixed(2) : "0.00";
    }

    const data = {
        provider,
        providerBankId: mapping.providerBankId,
        account,
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
