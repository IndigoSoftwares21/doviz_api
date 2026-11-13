import Decimal from "decimal.js";
import { ProviderAccountDeposit } from "../../virtualAccountProvider";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * A Squad virtual-account transaction → our deposit. Amounts are naira
 * strings ("100.00"). A frozen transaction (Squad holding it for review) is
 * pending — never credited until Squad releases it.
 */
const mapSquadDeposit = (row: Record<string, unknown>): ProviderAccountDeposit | null => {
    const reference = text(row.transaction_reference);
    const accountNumber = text(row.virtual_account_number);
    if (!reference || !accountNumber || row.principal_amount === undefined) return null;
    const currency = text(row.currency) ?? "NGN";
    const frozen = row.frozen_transaction !== null && row.frozen_transaction !== undefined && row.frozen_transaction !== false;
    const masked = String(row.masked_sender_account_number ?? "").replace(/\D/g, "");
    return {
        reference,
        accountNumber,
        status: frozen ? "pending" : "completed",
        amount: { amount: new Decimal(String(row.principal_amount)).toFixed(2), currency },
        fee: row.fee_charged === undefined || row.fee_charged === null ? null : { amount: new Decimal(String(row.fee_charged)).toFixed(2), currency },
        paidAt: text(row.transaction_date) ? new Date(text(row.transaction_date)!) : null,
        sender: { name: text(row.sender_name), bankName: null, bankCode: null, accountNumber: masked ? `******${masked.slice(-4)}` : null },
    };
};

export default mapSquadDeposit;
