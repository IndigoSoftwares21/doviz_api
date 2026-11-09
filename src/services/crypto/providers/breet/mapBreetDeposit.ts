import monitoring from "@/utils/monitoring";
import { ProviderDeposit } from "../../types";
import { BreetTransaction } from "./breetTypes";
import mapBreetStatus from "./mapBreetStatus";
import toDecimalString from "./toDecimalString";

/**
 * Breet transaction record → neutral deposit. `amount` is the naira Breet
 * credited Doviz (net of its fee) — only valid when the merchant wallet is
 * NGN; otherwise grossNgn is null and the deposit can't be credited.
 */
const mapBreetDeposit = ({
    transaction,
    providerCode,
}: {
    transaction: BreetTransaction;
    providerCode: string;
}): ProviderDeposit => {
    const isNgn = (transaction.currency ?? "").toLowerCase() === "ngn";
    if (!isNgn) {
        monitoring.warn(`Breet transaction ${transaction.id} settled in "${transaction.currency}", expected ngn`);
    }

    return {
        reference: transaction.id,
        address: transaction.address,
        providerCode,
        providerAssetId: transaction.asset,
        status: mapBreetStatus({ status: transaction.status }),
        subStatus: transaction.reason || null,
        cryptoAmount: toDecimalString({ value: transaction.cryptoReceived }) ?? "0",
        grossNgn: isNgn ? toDecimalString({ value: transaction.amount }) : null,
        reportedUsd: toDecimalString({ value: transaction.amountReceived }),
        rateNgnPerUsd: toDecimalString({ value: transaction.rate }),
        txHash: transaction.txHash || null,
        senderAddress: transaction.sourceAddress || null,
        confirmations: typeof transaction.confirmations === "number" ? transaction.confirmations : null,
        amlPassed: typeof transaction.passAMLCheck === "boolean" ? transaction.passAMLCheck : null,
        occurredAt: new Date(transaction.updatedAt),
    };
};

export default mapBreetDeposit;
