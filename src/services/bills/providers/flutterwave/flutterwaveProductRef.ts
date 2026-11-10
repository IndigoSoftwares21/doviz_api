import { BILL_PROVIDER_ERROR_CODE } from "@/constants/bills";
import BillProviderError from "../../billProviderError";

/**
 * Our opaque product ref for Flutterwave is "<biller_code>:<item_code>":
 * item codes are NOT unique across billers (UB160 is both Ikeja and Benin),
 * and every bill call needs both.
 */
export const toFlutterwaveProductRef = ({ billerCode, itemCode }: { billerCode: string; itemCode: string }) => `${billerCode}:${itemCode}`;

export const parseFlutterwaveProductRef = ({ providerProductRef }: { providerProductRef: string }) => {
    const match = /^([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(providerProductRef);
    if (!match) {
        throw new BillProviderError({ code: BILL_PROVIDER_ERROR_CODE.REJECTED, status: null, providerMessage: "Malformed Flutterwave product ref" });
    }
    return { billerCode: match[1], itemCode: match[2] };
};
