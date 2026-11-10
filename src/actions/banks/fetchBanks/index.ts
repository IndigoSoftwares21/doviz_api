import fetchActivePayoutProvider from "@/actions/payoutProvider/fetchActivePayoutProvider";
import selectPayoutBanks from "./queries/selectPayoutBanks";

/** Banks the active PAYOUT provider can look up and pay to (so a linked account can be withdrawn to). */
const fetchBanks = async () => {
    const { data: provider } = await fetchActivePayoutProvider();
    const data = await selectPayoutBanks({ provider: provider.name, environment: provider.environment });

    return { data };
};

export default fetchBanks;
