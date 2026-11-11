import { ProviderAsset } from "../../types";
import { BreetAsset } from "./breetTypes";
import mapBreetNetwork from "./mapBreetNetwork";

const mapBreetAsset = ({ asset }: { asset: BreetAsset }): ProviderAsset => {
    const symbol = asset.symbol.toUpperCase();

    return {
        providerAssetId: asset.id,
        providerCode: asset.identifier,
        symbol,
        network: mapBreetNetwork({ network: asset.network, type: asset.type }),
        name: asset.name,
        // Breet's `minimum` is USD, not coin units — the coin minimum comes live from getMinDeposit.
        minDeposit: null,
        confirmations: typeof asset.confirmations === "number" ? asset.confirmations : null,
    };
};

export default mapBreetAsset;
