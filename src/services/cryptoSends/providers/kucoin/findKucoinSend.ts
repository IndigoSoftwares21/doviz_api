import { CRYPTO_SEND_ERROR_CODE } from "@/constants/cryptoPurchases";
import CryptoSendProviderError from "../../cryptoSendProviderError";
import { ProviderSend } from "../../types";
import KUCOIN from "./constants";
import KucoinClient from "./kucoinClient";
import { fromProviderAssetId } from "./kucoinAssetId";
import { KucoinWithdrawal, KucoinWithdrawalPage } from "./kucoinTypes";
import mapKucoinSend from "./mapKucoinSend";

const isNotFound = (error: unknown) => error instanceof CryptoSendProviderError && error.code === CRYPTO_SEND_ERROR_CODE.NOT_FOUND;

/**
 * A withdrawal by KuCoin's id, or — when the send's response was lost and we
 * never learned it — by our purchase id in `remark` among recent withdrawals.
 * null = KuCoin has no record of it.
 */
const findKucoinSend = async ({ client, externalId, providerReference, providerAssetId }: { client: KucoinClient; externalId: string; providerReference: string | null; providerAssetId: string }): Promise<ProviderSend | null> => {
    if (providerReference) {
        try {
            const record = await client.request<KucoinWithdrawal | null>({ method: "GET", path: `/api/v1/withdrawals/${providerReference}` });
            return record ? mapKucoinSend({ externalId, record }) : null;
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }

    const { currency } = fromProviderAssetId({ providerAssetId });
    const page = await client.request<KucoinWithdrawalPage>({
        method: "GET",
        path: "/api/v1/withdrawals",
        query: { currency, currentPage: "1", pageSize: String(KUCOIN.HISTORY_PAGE_SIZE) },
    });
    const record = (page?.items ?? []).find((item) => item.remark === externalId);
    return record ? mapKucoinSend({ externalId, record }) : null;
};

export default findKucoinSend;
