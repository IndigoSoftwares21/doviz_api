import Decimal from "decimal.js";
import { CRYPTO_SEND_ERROR_CODE } from "@/constants/cryptoPurchases";
import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";
import { CryptoSendProvider } from "../../cryptoSendProvider";
import CryptoSendProviderError from "../../cryptoSendProviderError";
import { ProviderSend, ProviderSendableAsset, ProviderSendTerms } from "../../types";
import KUCOIN, { KUCOIN_ACCOUNT_MODE } from "./constants";
import KucoinClient from "./kucoinClient";
import { fromProviderAssetId } from "./kucoinAssetId";
import { KucoinAccount, KucoinCurrency, KucoinWithdrawalQuota } from "./kucoinTypes";
import mapKucoinCurrency from "./mapKucoinCurrency";
import findKucoinSend from "./findKucoinSend";

export { toProviderAssetId, fromProviderAssetId } from "./kucoinAssetId";

/**
 * KuCoin sends crypto from our funding ("main") account behind the neutral
 * CryptoSendProvider. No sandbox (production only), no withdrawal webhooks
 * (results are checked with getSend), no idempotency key on withdraw — our
 * purchase id goes in `remark` so a lost response can be found again.
 */
class KucoinCryptoSendProvider implements CryptoSendProvider {
    readonly name = KUCOIN.PROVIDER_NAME;
    readonly environment = PROVIDER_ENVIRONMENT.PRODUCTION;
    private readonly client: KucoinClient;

    constructor({ client }: { client?: KucoinClient } = {}) {
        this.client = client ?? new KucoinClient();
    }

    async listSendableAssets(): Promise<ProviderSendableAsset[]> {
        const assets: ProviderSendableAsset[] = [];
        for (const code of KUCOIN.SEND_CURRENCIES) {
            const currency = await this.client.request<KucoinCurrency>({ method: "GET", path: `/api/v3/currencies/${code}`, isPublic: true });
            assets.push(...mapKucoinCurrency({ currency }));
        }
        return assets;
    }

    /**
     * Live fee/minimum from the quotas endpoint. It doesn't say whether a memo
     * is needed, so that comes from the currency endpoint (public, one call).
     */
    async getSendTerms({ providerAssetId }: { providerAssetId: string }): Promise<ProviderSendTerms> {
        const { currency, chain } = fromProviderAssetId({ providerAssetId });
        const [quota, info] = await Promise.all([
            this.client.request<KucoinWithdrawalQuota>({ method: "GET", path: "/api/v1/withdrawals/quotas", query: { currency, chain } }),
            this.client.request<KucoinCurrency>({ method: "GET", path: `/api/v3/currencies/${currency}`, query: { chain }, isPublic: true }),
        ]);
        const chainInfo = info.chains?.find((candidate) => candidate.chainId === chain);
        return {
            fee: quota.withdrawMinFee,
            minAmount: quota.withdrawMinSize,
            precision: quota.precision,
            memoRequired: chainInfo?.needTag === true,
            isEnabled: quota.isWithdrawEnabled === true,
        };
    }

    async getBalance({ providerAssetId }: { providerAssetId: string }): Promise<string> {
        const { currency } = fromProviderAssetId({ providerAssetId });
        const accounts = await this.client.request<KucoinAccount[]>({ method: "GET", path: "/api/v1/accounts", query: { type: "main", currency } });
        return (accounts ?? []).reduce((sum, account) => sum.plus(account.available || "0"), new Decimal(0)).toFixed();
    }

    async send({ externalId, providerAssetId, address, memo, amount }: { externalId: string; providerAssetId: string; address: string; memo: string | null; amount: string }): Promise<ProviderSend> {
        const { currency, chain } = fromProviderAssetId({ providerAssetId });
        const toSend = KUCOIN.FEE_INCLUDED_IN_AMOUNT ? new Decimal(amount).plus((await this.getSendTerms({ providerAssetId })).fee).toFixed() : amount;
        const path = this.client.config.accountMode === KUCOIN_ACCOUNT_MODE.UNIFIED ? "/api/ua/v2/asset/withdrawal" : "/api/v3/withdrawals";
        const result = await this.client.request<{ withdrawalId: string }>({
            method: "POST",
            path,
            body: { currency, chain, toAddress: address, amount: toSend, withdrawType: "ADDRESS", isInner: false, remark: externalId, ...(memo ? { memo } : {}) },
        });
        if (!result?.withdrawalId) {
            throw new CryptoSendProviderError({ code: CRYPTO_SEND_ERROR_CODE.INVALID_RESPONSE, status: 200, providerMessage: "KuCoin returned no withdrawalId" });
        }
        return { externalId, providerReference: result.withdrawalId, status: "pending", amount, fee: null, txHash: null, failureReason: null };
    }

    getSend({ externalId, providerReference, providerAssetId }: { externalId: string; providerReference: string | null; providerAssetId: string }) {
        return findKucoinSend({ client: this.client, externalId, providerReference, providerAssetId });
    }
}

export default KucoinCryptoSendProvider;
