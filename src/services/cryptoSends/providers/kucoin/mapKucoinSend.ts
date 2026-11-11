import { PROVIDER_SEND_STATUS, ProviderSendStatus } from "@/constants/cryptoPurchases";
import { ProviderSend } from "../../types";
import { KucoinWithdrawal } from "./kucoinTypes";

/**
 * KuCoin withdrawal status → ours. Only SUCCESS is documented; FAILURE is
 * assumed from KuCoin's history filters. Anything else (PROCESSING,
 * WALLET_PROCESSING, REVIEW, unknown) stays pending — never guess a failure,
 * because a "failed" refunds the user.
 */
export const mapKucoinStatus = ({ status }: { status: string }): ProviderSendStatus => {
    const upper = status.toUpperCase();
    if (upper === "SUCCESS") return PROVIDER_SEND_STATUS.COMPLETED;
    if (upper === "FAILURE") return PROVIDER_SEND_STATUS.FAILED;
    return PROVIDER_SEND_STATUS.PENDING;
};

const mapKucoinSend = ({ externalId, record }: { externalId: string; record: KucoinWithdrawal }): ProviderSend => ({
    externalId,
    providerReference: record.id,
    status: mapKucoinStatus({ status: record.status }),
    amount: record.amount ?? null,
    fee: record.fee ?? null,
    txHash: record.walletTxId || null,
    failureReason: record.failureReasonMsg || record.failureReason || null,
});

export default mapKucoinSend;
