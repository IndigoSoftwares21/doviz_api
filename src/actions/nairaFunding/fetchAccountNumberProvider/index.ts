import selectNairaFundingProvider from "@/actions/nairaFunding/fetchNairaFundingOptions/queries/selectNairaFundingProvider";
import { DEFAULT_ACCOUNT_NUMBER_PROVIDER, NAIRA_FUNDING_MODE, NAIRA_FUNDING_PROVIDERS } from "@/constants/nairaFunding";

/**
 * Which provider issues account numbers now: the `naira_funding` setting when
 * it names an account-number provider, else the default. null when Add money
 * is switched to the one-time transfer flow (no account numbers are issued).
 * Server-only — the app never learns provider names.
 */
const fetchAccountNumberProvider = async () => {
    const setting = await selectNairaFundingProvider();
    const name = setting?.activeProvider ?? DEFAULT_ACCOUNT_NUMBER_PROVIDER;
    const mode = NAIRA_FUNDING_PROVIDERS[name];
    if (mode === NAIRA_FUNDING_MODE.BANK_TRANSFER) return { data: null };
    return { data: mode === NAIRA_FUNDING_MODE.ACCOUNT_NUMBER ? name : DEFAULT_ACCOUNT_NUMBER_PROVIDER };
};

export default fetchAccountNumberProvider;
