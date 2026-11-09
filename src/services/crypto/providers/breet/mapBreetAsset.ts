import { ProviderAsset } from "../../types";
import { BreetAsset } from "./breetTypes";
import mapBreetNetwork from "./mapBreetNetwork";
import toDecimalString from "./toDecimalString";

const mapBreetAsset = ({ asset }: { asset: BreetAsset }): ProviderAsset => {
    const symbol = asset.symbol.toUpperCase();

    return {
        providerAssetId: asset.id,
        providerCode: asset.identifier,
        symbol,
        network: mapBreetNetwork({ network: asset.network, type: asset.type }),
        name: asset.name,
        minDeposit: toDecimalString({ value: asset.minimum }),
        confirmations: typeof asset.confirmations === "number" ? asset.confirmations : null,
    };
};

export default mapBreetAsset;
