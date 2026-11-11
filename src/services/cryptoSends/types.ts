import { ProviderSendStatus } from "@/constants/cryptoPurchases";

/** Provider-neutral shapes. Crypto amounts are decimal strings in the coin. */

/** A coin on a network that the provider can send, in its own terms. */
export interface ProviderSendableAsset {
    /** The provider's own key for this coin+network (opaque to us). */
    providerAssetId: string;
    /** The provider's code for the coin, e.g. "USDT". */
    providerCode: string;
    /** Coin symbol, uppercased ("USDT"). */
    symbol: string;
    /** The provider's network/chain id ("trx", "bsc") — mapped to ours by the sync script. */
    providerNetwork: string;
    terms: ProviderSendTerms;
}

export interface ProviderSendTerms {
    /** The provider's fee for one send, in the coin. */
    fee: string;
    /** Smallest amount it will send. */
    minAmount: string;
    /** Decimal places it accepts. */
    precision: number;
    memoRequired: boolean;
    isEnabled: boolean;
}

export interface ProviderSend {
    /** OUR purchase id. */
    externalId: string;
    providerReference: string | null;
    status: ProviderSendStatus;
    /** What the provider says it sent, when it says. */
    amount: string | null;
    /** The fee it actually charged, when it says. */
    fee: string | null;
    txHash: string | null;
    failureReason: string | null;
}
