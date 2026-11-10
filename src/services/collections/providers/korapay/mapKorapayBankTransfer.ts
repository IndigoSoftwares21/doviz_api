import Decimal from "decimal.js";
import { COLLECTION_PROVIDER_ERROR_CODE, FEE_BEARER, FeeBearer } from "@/constants/nairaDeposits";
import CollectionProviderError from "../../collectionProviderError";
import { Money, ProviderBankTransferCreated } from "../../types";
import KORAPAY from "./constants";
import { KorapayBankTransferCharge } from "./korapayTypes";
import sumKorapayFee from "./sumKorapayFee";
import toKorapayMoney from "./toKorapayMoney";

const invalid = (message: string) =>
    new CollectionProviderError({ code: COLLECTION_PROVIDER_ERROR_CODE.INVALID_RESPONSE, status: null, providerMessage: message });

/**
 * POST /charges/bank-transfer → the account to show the user. What to send is
 * Korapay's `amount_expected` (it adds its fee when the customer bears it);
 * the fee is `fee` + `vat`, else the difference. Throws rather than show an
 * account we can't fully describe.
 */
const mapKorapayBankTransfer = ({
    externalId,
    amount,
    feeBearer,
    charge,
}: {
    externalId: string;
    amount: Money;
    feeBearer: FeeBearer;
    charge: KorapayBankTransferCharge;
}): ProviderBankTransferCreated => {
    const account = charge.bank_account;
    if (!account?.account_number || !account.bank_name) throw invalid("Bank transfer charge has no account");

    const expiresAt = account.expiry_date_in_utc ? new Date(account.expiry_date_in_utc) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) throw invalid("Bank transfer charge has no expiry");

    const quotedFee = sumKorapayFee({ fee: charge.fee, vat: charge.vat });
    const expected = toKorapayMoney({ value: charge.amount_expected });
    const toTransfer =
        expected ?? (feeBearer === FEE_BEARER.USER && quotedFee ? new Decimal(amount.amount).plus(quotedFee).toFixed(2) : amount.amount);
    const fee = quotedFee ?? Decimal.max(new Decimal(toTransfer).minus(amount.amount), 0).toFixed(2);
    if (feeBearer === FEE_BEARER.USER && new Decimal(toTransfer).lessThan(amount.amount)) {
        throw invalid("Bank transfer charge expects less than the deposit amount");
    }

    const currency = charge.currency || KORAPAY.CURRENCY;
    return {
        providerReference: charge.payment_reference || charge.reference || externalId,
        bankAccount: {
            accountName: account.account_name || "",
            accountNumber: account.account_number,
            bankName: account.bank_name,
        },
        amountToTransfer: { amount: toTransfer, currency },
        fee: { amount: fee, currency },
        expiresAt,
    };
};

export default mapKorapayBankTransfer;
