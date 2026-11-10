import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import CollectionProviderError from "@/services/collections/collectionProviderError";
import { CreateBankTransferArgs, ProviderBankTransferCreated } from "@/services/collections/types";
import monitoring from "@/utils/monitoring";
import { COLLECTION_PROVIDER_ERROR_CODE } from "@/constants/nairaDeposits";

/**
 * Asks the active providers, in order, for a one-time account; the first that
 * issues one wins. A provider error moves on to the next (an account issued
 * but never shown can't be paid, so nothing is lost). null = none could.
 */
const issueBankTransfer = async (args: CreateBankTransferArgs): Promise<{ provider: string; transfer: ProviderBankTransferCreated } | null> => {
    for (const provider of collectionProviderRegistry.active()) {
        try {
            const transfer = await provider.createBankTransfer(args);
            return { provider: provider.name, transfer };
        } catch (error) {
            if (!(error instanceof CollectionProviderError)) throw error;
            const message = `Naira deposit ${args.externalId}: ${provider.name} couldn't issue an account (${error.code}) — trying the next provider`;
            if (error.code === COLLECTION_PROVIDER_ERROR_CODE.CONFIGURATION) monitoring.error(message, error);
            else monitoring.warn(message, { providerMessage: error.providerMessage });
        }
    }
    return null;
};

export default issueBankTransfer;
