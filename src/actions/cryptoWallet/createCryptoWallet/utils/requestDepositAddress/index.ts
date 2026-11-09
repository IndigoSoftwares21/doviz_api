import { CryptoProvider } from "@/services/crypto/cryptoProvider";
import monitoring from "@/utils/monitoring";
import { PROVIDER_ERROR_CODE } from "@/constants/cryptoStatus";

/**
 * Asks the provider for the address behind `label`. If an earlier attempt
 * already created it (response lost), recovers it instead of failing.
 * Returns null when the provider can't issue it right now.
 */
const requestDepositAddress = async ({
    provider,
    providerAssetId,
    providerCode,
    label,
}: {
    provider: CryptoProvider;
    providerAssetId: string;
    providerCode: string;
    label: string;
}) => {
    try {
        const issued = await provider.createDepositAddress({ providerAssetId, label });
        return issued;
    } catch (error) {
        if ((error as { code?: string } | null)?.code === PROVIDER_ERROR_CODE.LABEL_EXISTS) {
            const recovered = await provider.findAddressByLabel({ providerCode, label });
            return recovered;
        }
        monitoring.error(`Deposit address request failed (${provider.name})`, error as Error);
        return null;
    }
};

export default requestDepositAddress;
