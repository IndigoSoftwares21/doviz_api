import { ProviderEnvironment } from "@/constants/crypto";
import { PayoutMoney, ProviderPayout, ProviderPayoutBank } from "./types";

/**
 * The only way the app pays naira out to a bank account. Implementations live
 * under services/payouts/providers/<name>/ (Korapay first); provider quirks
 * stay there. Which provider takes NEW withdrawals is chosen in the database
 * (provider_settings); a withdrawal always finishes with the provider on its row.
 */
export interface PayoutProvider {
    readonly name: string;
    readonly environment: ProviderEnvironment;

    /**
     * This provider's own per-payout limits, when it has them. Checked before
     * anything is held (our general limits in constants/withdrawals still apply).
     */
    readonly limits?: { minAmount: string; maxAmount: string };

    listBanks(): Promise<ProviderPayoutBank[]>;

    /** The account holder's name, from the bank. Failures throw PayoutProviderError. */
    resolveAccount(args: { providerBankId: string; accountNumber: string }): Promise<{ accountName: string }>;

    /**
     * Sends a payout. `externalId` is our withdrawal id and the provider's
     * reference, so a timed-out request can be looked up. Must be safe to
     * call again with the same externalId (returns the existing payout).
     */
    sendPayout(args: {
        externalId: string;
        providerBankId: string;
        accountNumber: string;
        accountName: string;
        amount: PayoutMoney;
        narration: string;
        customer: { name: string; email: string | null };
    }): Promise<ProviderPayout>;

    /** By our external id. null = the provider has no record of it. */
    getPayout(args: { externalId: string }): Promise<ProviderPayout | null>;

    /** The exact fee before sending, for providers that can quote it; null when they can't. */
    quoteFee?(args: { amount: PayoutMoney }): Promise<PayoutMoney | null>;

    /** The balance payouts are drawn from; null when the provider can't report it (the check is skipped). */
    getBalance?(args: { currency: string }): Promise<PayoutMoney | null>;
}
