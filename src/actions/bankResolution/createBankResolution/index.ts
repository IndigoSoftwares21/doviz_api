import providerRegistry from "@/services/crypto/providerRegistry";
import getProviderEnvironment from "@/utils/crypto/getProviderEnvironment";
import accountNameMatches from "@/utils/names/accountNameMatches";
import monitoring from "@/utils/monitoring";
import selectResolutionBank from "./queries/selectResolutionBank";
import selectResolutionUser from "./queries/selectResolutionUser";
import ACTION_FAILURE from "@/constants/actionFailure";

/** Looks up the account holder's name and checks it's the user's own account. */
const createBankResolution = async ({
    userId,
    bankId,
    accountNumber,
}: {
    userId: string;
    bankId: string;
    accountNumber: string;
}) => {
    const provider = providerRegistry.active();
    const bank = await selectResolutionBank({ bankId, provider: provider.name, environment: getProviderEnvironment() });
    const user = await selectResolutionUser({ userId });

    let accountName: string;
    try {
        ({ accountName } = await provider.resolveBankAccount({ providerBankId: bank.providerBankId, accountNumber }));
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
