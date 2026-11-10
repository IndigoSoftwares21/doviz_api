import Decimal from "decimal.js";
import { PROVIDER_TRANSFER_STATUS } from "@/constants/nairaDeposits";
import { ProviderBankTransfer } from "../../types";
import KORAPAY from "./constants";
import { KorapayCharge } from "./korapayTypes";
import mapKorapayChargeStatus from "./mapKorapayChargeStatus";
import sumKorapayFee from "./sumKorapayFee";
import toKorapayMoney from "./toKorapayMoney";

/**
 * GET /charges/{reference} → neutral transfer. `amount_paid` is what the
 * payer sent (gross); a completed charge without it falls back to `amount`.
 * Korapay answers an unpaid charge with `amount_paid: "0.00"` and `fee: 0`
 * (sandbox, Nov 2026) — zeros mean "not known", never "free".
 */
const mapKorapayCharge = ({ externalId, charge }: { externalId: string; charge: KorapayCharge }): ProviderBankTransfer => {
    const status = mapKorapayChargeStatus({ status: charge.status });
    const currency = charge.currency || KORAPAY.CURRENCY;
    const positive = (value: string | null) => (value !== null && new Decimal(value).greaterThan(0) ? value : null);
    const paid = positive(toKorapayMoney({ value: charge.amount_paid })) ?? (status === PROVIDER_TRANSFER_STATUS.COMPLETED ? positive(toKorapayMoney({ value: charge.amount })) : null);
    const fee = positive(sumKorapayFee({ fee: charge.fee, vat: charge.vat }));
    const paidAt = charge.transaction_date ? new Date(charge.transaction_date) : null;

    return {
        externalId,
        providerReference: charge.payment_reference || charge.reference || null,
        status,
        amountPaid: paid ? { amount: paid, currency } : null,
        fee: fee ? { amount: fee, currency } : null,
        paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    };
};

export default mapKorapayCharge;
