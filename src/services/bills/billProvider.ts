import { ProviderEnvironment } from "@/constants/crypto";
import { Money, ProviderBillCatalog, ProviderBillPayment, ProviderCustomer } from "./types";

/**
 * The only way the app talks to a bill payment provider. Implementations are
 * classes under services/bills/providers/<name>/ (Flutterwave first). Provider
 * quirks — codes, status strings, where the token lives — are translated
 * inside the implementation and never leak out. Switching provider must never
 * need an app change.
 */
export interface BillProvider {
    readonly name: string;
    /** sandbox or production — selects the catalog rows synced for it. */
    readonly environment: ProviderEnvironment;

    /**
     * Every biller and product this provider sells, in its own words. No
     * matching or cleaning — the shared catalog sync does that for all providers.
     */
    listCatalog(): Promise<ProviderBillCatalog>;

    /**
     * Looks up the account behind a meter / smartcard / account number.
     * Failures throw BillProviderError (`rejected` = no such customer).
     */
    validateCustomer(args: { providerProductRef: string; customerId: string }): Promise<ProviderCustomer>;

    /**
     * Starts a payment. `externalId` is our bill_payments.id and is sent as the
     * provider's own reference, so a lost response can be looked up with
     * getBillPayment. Usually returns `pending`. Must be safe to call twice
     * with the same externalId (a retry returns the existing payment).
     * Failures throw BillProviderError — see its codes for what's refundable.
     */
    payBill(args: {
        externalId: string;
        providerProductRef: string;
        customerId: string;
        amount: Money;
    }): Promise<ProviderBillPayment>;

    /**
     * By OUR external id, plus the provider's own reference when we have it
     * (some providers can only look up by theirs). null = no record of it.
     */
    getBillPayment(args: { externalId: string; providerReference: string | null }): Promise<ProviderBillPayment | null>;
}
