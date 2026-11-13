import { BillAmountType, BillCategory, ProviderBillStatus } from "@/constants/bills";

/**
 * Provider-neutral shapes. Every bill provider maps its own API into these, so
 * nothing outside services/bills/providers knows which provider is in use.
 * Amounts are decimal STRINGS with their currency — never JS numbers, never
 * assumed to be naira.
 *
 * Catalog shapes are deliberately RAW: a provider reports what it sells in its
 * own words, and the shared catalog code (services/bills/catalog) does the
 * matching to our billers and the name cleaning. So a new provider only has
 * to fetch and translate its API — never learn our billers or naming rules.
 */

export interface Money {
    /** Decimal string, e.g. "1500.00". */
    amount: string;
    /** ISO 4217, e.g. "NGN". */
    currency: string;
}

/**
 * One biller as the provider names it. If a provider puts several categories
 * under one biller (e.g. MTN airtime AND data), its code must split them into
 * one ProviderBiller per category.
 */
export interface ProviderBiller {
    providerBillerRef: string;
    /** Raw, e.g. "MTN DATA BUNDLE". */
    name: string;
    /** Only when the provider states it outright; otherwise inferred from names. */
    categoryHint: BillCategory | null;
    /** Raw label for the customer id, e.g. "SmartCard Number". */
    customerIdLabel: string | null;
    logoUrl: string | null;
}

/** One thing a provider sells. `providerProductRef` is opaque outside that provider and unique within it. */
export interface ProviderBillProduct {
    providerProductRef: string;
    providerBillerRef: string;
    /** Raw, e.g. "AIRTEL 1.3GB data bundle". */
    name: string;
    amountType: BillAmountType;
    currency: string;
    /** Set for `fixed` products. */
    price: string | null;
    /** For `range` products, when the provider gives limits (category defaults otherwise). */
    minAmount: string | null;
    maxAmount: string | null;
    /** What the provider charges us per payment on top of the amount, when it states one (decimal string). */
    providerFee: string | null;
    /** When the provider states it; otherwise parsed from the name. */
    validityDays: number | null;
}

export interface ProviderBillCatalog {
    billers: ProviderBiller[];
    products: ProviderBillProduct[];
}

export interface ProviderCustomer {
    customerName: string | null;
    address: string | null;
    /** Provider's limits for this customer, when it gives them. */
    minAmount: string | null;
    maxAmount: string | null;
}

export interface ProviderBillPayment {
    /** OUR bill_payments.id, sent to the provider as its reference. */
    externalId: string;
    providerReference: string | null;
    status: ProviderBillStatus;
    amount: Money;
    /** What the provider charged Doviz for this payment, when it says. */
    cost: Money | null;
    /** Prepaid electricity token or PIN, when there is one. */
    token: string | null;
    failureReason: string | null;
}
