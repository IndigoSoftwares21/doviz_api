import { ProviderSendableAsset } from "../../types";
import { toProviderAssetId } from "./kucoinAssetId";
import { KucoinCurrency } from "./kucoinTypes";

/** One sendable asset per chain of a KuCoin currency (GET /api/v3/currencies/{currency}). */
const mapKucoinCurrency = ({ currency }: { currency: KucoinCurrency }): ProviderSendableAsset[] =>
    (currency.chains ?? []).map((chain) => ({
        providerAssetId: toProviderAssetId({ currency: currency.currency, chain: chain.chainId }),
        providerCode: currency.currency,
        symbol: currency.currency.toUpperCase(),
        providerNetwork: chain.chainId,
        terms: {
            fee: chain.withdrawalMinFee ?? chain.withdrawMinFee ?? "0",
            minAmount: chain.withdrawalMinSize ?? chain.withdrawMinSize ?? "0",
            precision: chain.withdrawPrecision ?? currency.precision ?? 8,
            memoRequired: chain.needTag === true,
            isEnabled: chain.isWithdrawEnabled === true,
        },
    }));

export default mapKucoinCurrency;
