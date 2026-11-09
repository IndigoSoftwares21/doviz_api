import BreetClient from "./breetClient";
import ProviderError from "./providerError";
import { PROVIDER_ERROR_CODE } from "@/constants/cryptoStatus";

interface ICreateBreetDepositAddress {
    client: BreetClient;
    providerAssetId: string;
    label: string;
}

/** Issues a labelled deposit address; a reused label becomes LABEL_EXISTS so callers recover it by label. */
const createBreetDepositAddress = async ({ client, providerAssetId, label }: ICreateBreetDepositAddress) => {
    try {
        const path = `/trades/sell/assets/${encodeURIComponent(providerAssetId)}/generate-address`;
        const result = await client.request<{ id: string; address: string }>({ method: "POST", path, body: { label } });
        return { providerWalletId: result.id, address: result.address };
    } catch (error) {
        if (error instanceof ProviderError && error.status === 400 && /already exists/i.test(error.providerMessage ?? "")) {
            throw new ProviderError({ code: PROVIDER_ERROR_CODE.LABEL_EXISTS, status: 400, retryable: false, providerMessage: error.providerMessage });
        }
        throw error;
    }
};

export default createBreetDepositAddress;
