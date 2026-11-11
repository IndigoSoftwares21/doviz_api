import { FeeBearer, ProviderTransferStatus } from "@/constants/nairaDeposits";
import { Money } from "@/services/bills/types";

export type { Money };

/**
 * Provider-neutral shapes. Every collection provider maps its own API into
 * these, so nothing outside services/collections/providers knows which
 * provider is in use. Amounts are decimal strings with their currency.
 */

export interface ProviderBankAccount {
    accountName: string;
    accountNumber: string;
    bankName: string;
}

/** A one-time account the provider just issued. */
export interface ProviderBankTransferCreated {
    providerReference: string;
    bankAccount: ProviderBankAccount;
    /** Exactly what the payer must send (includes the fee when the user bears it). */
    amountToTransfer: Money;
    /** The provider's fee for this transfer, whoever bears it. */
    fee: Money;
    expiresAt: Date;
}

/**
 * Who sent the money: the EXTERNAL account it came from (never our own
 * collection account). `accountNumber` is masked to its last 4 digits.
 */
export interface ProviderTransferSender {
    name: string | null;
    bankName: string | null;
    bankCode: string | null;
    accountNumber: string | null;
}

/** The provider's own record of a transfer. */
export interface ProviderBankTransfer {
    /** OUR naira_deposits.id, sent as the provider's reference. */
    externalId: string;
    providerReference: string | null;
    status: ProviderTransferStatus;
    /** Gross: what the payer actually sent. null until paid. */
    amountPaid: Money | null;
    /** What the provider kept, whoever bore it. null until paid. */
    fee: Money | null;
    paidAt: Date | null;
    /** null when the provider doesn't say (or not paid yet). */
    sender: ProviderTransferSender | null;
}

export interface CreateBankTransferArgs {
    externalId: string;
    /** What the user should receive. */
    amount: Money;
    feeBearer: FeeBearer;
    customer: { name: string | null; email: string | null };
    narration: string;
}
