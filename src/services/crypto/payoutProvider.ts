import { ProviderPayout } from "./types";

/**
 * Pays naira to users' bank accounts. Not Breet: Breet only pays to banks
 * saved on Doviz's own account (max 3). To be implemented when a payout /
 * naira-account provider is chosen; withdrawals use this interface only.
 */
export interface PayoutProvider {
    readonly name: string;

    /** `externalId` is our withdrawal id, so a timed-out request can be looked up. */
    sendBankPayout(args: {
        externalId: string;
        bankCode: string;
        accountNumber: string;
        accountName: string;
        amountNgn: string;
        narration: string;
    }): Promise<{ reference: string }>;

    /** By provider reference or our external id. */
    getPayout(args: { referenceOrExternalId: string }): Promise<ProviderPayout | null>;
}
