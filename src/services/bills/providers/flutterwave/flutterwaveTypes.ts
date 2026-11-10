/**
 * Flutterwave v3 bill API shapes (snake_case, as sent). Only fields we read.
 * Catalog item shape verified against the sandbox (GET /bill-categories, Nov 2026);
 * validate / payment / status shapes are from the docs until verified.
 */

export interface FlutterwaveBillItem {
    id: number;
    biller_code: string;
    /** The biller's name, e.g. "MTN DATA BUNDLE". */
    name: string;
    /** The ITEM's name, e.g. "MTN 1.5 GB" — despite the field name. */
    biller_name: string | null;
    short_name: string | null;
    item_code: string;
    country: string;
    is_airtime: boolean;
    label_name: string | null;
    /** 0 = any amount (airtime, electricity); otherwise the fixed price. */
    amount: number;
    fee: number | null;
    validity_period?: string | number | null;
    logo?: string | null;
}

export interface FlutterwaveCustomerValidation {
    response_code?: string | null;
    response_message?: string | null;
    name?: string | null;
    address?: string | null;
    minimum?: number | string | null;
    maximum?: number | string | null;
}

export interface FlutterwaveBillPaymentCreated {
    tx_ref?: string | null;
    reference?: string | null;
    flw_ref?: string | null;
    amount?: number | string | null;
    fee?: number | string | null;
    recharge_token?: string | null;
}

export interface FlutterwaveBillStatus {
    tx_ref?: string | null;
    flw_ref?: string | null;
    customer_reference?: string | null;
    status?: string | null;
    message?: string | null;
    amount?: number | string | null;
    fee?: number | string | null;
    commission?: number | string | null;
    currency?: string | null;
    /** Prepaid electricity token lives here (verbose responses). */
    extra?: string | null;
    /** …or here (short responses). */
    token?: string | null;
}
