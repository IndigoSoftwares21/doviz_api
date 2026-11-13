import selectNairaFundingProvider from "./queries/selectNairaFundingProvider";
import { DEFAULT_NAIRA_FUNDING_MODE, NAIRA_FUNDING_PROVIDERS } from "@/constants/nairaFunding";

/**
 * Which Add money flow is on (provider_settings → naira_funding). Missing or
 * unknown falls back to the account-number flow — never silently to the old one.
 */
const fetchNairaFundingOptions = async () => {
    const setting = await selectNairaFundingProvider();
    const mode = (setting && NAIRA_FUNDING_PROVIDERS[setting.activeProvider]) || DEFAULT_NAIRA_FUNDING_MODE;
    return { data: { mode } };
};

export default fetchNairaFundingOptions;
