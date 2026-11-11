import { ProviderEnvironment } from "@/constants/crypto";
import { ProviderSend, ProviderSendableAsset, ProviderSendTerms } from "./types";

/**
 * The only way the app sends crypto to a user's address (buying with naira).
 * We never hold keys: the provider sends from a balance we top up.
 * Implementations live under services/cryptoSends/providers/<name>/ (KuCoin
 * first); provider quirks — chain ids, statuses, fee handling, error codes —
 * stay there. Which provider takes NEW purchases is chosen in the database
 * (provider_settings 'crypto_sends'); a purchase always finishes with the
 * provider on its row. Optional methods may be absent: the caller skips that
 * step safely.
 */
export interface CryptoSendProvider {
    readonly name: string;
    readonly environment: ProviderEnvironment;

    /** Every coin+network it can send, with its terms. Used by the catalog sync. */
    listSendableAssets(): Promise<ProviderSendableAsset[]>;

    /** Live terms for one asset (the synced catalog can go stale). Optional. */
    getSendTerms?(args: { providerAssetId: string }): Promise<ProviderSendTerms>;

    /** Stock available to send, in the coin. Optional; null = can't tell (check skipped). */
    getBalance?(args: { providerAssetId: string }): Promise<string | null>;

    /**
     * Sends `amount` (exactly what the recipient must receive) to `address`.
     * `externalId` is our purchase id; the provider records it so a lost
     * response can be found with getSend. Failures throw CryptoSendProviderError.
     */
    send(args: { externalId: string; providerAssetId: string; address: string; memo: string | null; amount: string }): Promise<ProviderSend>;

    /**
     * Looks a send up by the provider's reference, or by our externalId when a
     * send's response was lost. null = the provider has no record of it.
     */
    getSend(args: { externalId: string; providerReference: string | null; providerAssetId: string }): Promise<ProviderSend | null>;
}
