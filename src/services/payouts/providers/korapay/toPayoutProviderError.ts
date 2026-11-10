import CollectionProviderError from "@/services/collections/collectionProviderError";
import PayoutProviderError from "../../payoutProviderError";
import { PAYOUT_PROVIDER_ERROR_CODE } from "@/constants/withdrawals";

/** The shared Korapay client speaks collection errors; payouts use the same codes under their own type. */
const toPayoutProviderError = ({ error }: { error: unknown }) => {
    if (error instanceof PayoutProviderError) return error;
    if (error instanceof CollectionProviderError) {
        return new PayoutProviderError({ code: error.code, status: error.status, providerMessage: error.providerMessage });
    }
    return new PayoutProviderError({ code: PAYOUT_PROVIDER_ERROR_CODE.UNAVAILABLE, status: null, providerMessage: (error as Error)?.message ?? null });
};

export default toPayoutProviderError;
