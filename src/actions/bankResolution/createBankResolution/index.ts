import fetchActivePayoutProvider from "@/actions/payoutProvider/fetchActivePayoutProvider";
import accountNameMatches from "@/utils/names/accountNameMatches";
import monitoring from "@/utils/monitoring";
import selectResolutionBank from "./queries/selectResolutionBank";
import selectResolutionUser from "./queries/selectResolutionUser";
import ACTION_FAILURE from "@/constants/actionFailure";

/** Looks up the account holder's name with the active payout provider and checks it's the user's own account. */
const createBankResolution = async ({
    userId,
    bankId,
    accountNumber,
}: {
    userId: string;
    bankId: string;
    accountNumber: string;
}) => {
    const { data: provider } = await fetchActivePayoutProvider();
    const bank = await selectResolutionBank({ bankId, provider: provider.name, environment: provider.environment });
    const user = await selectResolutionUser({ userId });

    let accountName: string;
    try {
        ({ accountName } = await provider.resolveAccount({ providerBankId: bank.providerBankId, accountNumber }));
    } catch (error) {
        monitoring.error(`Bank account lookup failed (${provider.name})`, error as Error);
        return { data: null, failure: ACTION_FAILURE.RESOLVE_FAILED };
    }

    const nameMatches = accountNameMatches({
        accountName,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
    });

    return { data: { accountName, nameMatches }, failure: null };
};

export default createBankResolution;
