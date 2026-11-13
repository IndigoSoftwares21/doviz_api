import Decimal from "decimal.js";
import { ProviderAccountDeposit } from "../../virtualAccountProvider";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const last4 = (value: unknown) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits ? `******${digits.slice(-4)}` : null;
};

/**
 * Fossapay's transaction (GET /wallets/fiat/transactions/:id) → our deposit.
 * Fossapay's `amount` is what reached the wallet AFTER its fee — seen live
 * (2026-11-13): ₦500 sent → { amount: 495, fee: 5 }. So what the sender sent
 * is amount + fee; reporting the net as "sent" would take the fee twice.
 * FOSSAPAY_AMOUNT_UNIT: naira (confirmed live) or kobo.
 */
const mapFossapayDeposit = ({ record, unit }: { record: Record<string, unknown>; unit: "naira" | "kobo" }): ProviderAccountDeposit | null => {
    const reference = text(record.transactionId) ?? text(record.id) ?? text(record.reference);
    const recipient = (record.recipient ?? {}) as Record<string, unknown>;
    const sender = (record.sender ?? {}) as Record<string, unknown>;
    const accountNumber = text(recipient.accountNumber) ?? text(record.accountNumber);
    if (!reference || !accountNumber || record.amount === undefined) return null;

    const money = (value: unknown) => new Decimal(String(value ?? 0)).div(unit === "kobo" ? 100 : 1);
    const net = money(record.amount);
    const fee = record.fee === undefined || record.fee === null ? null : money(record.fee);
    const state = String(record.status ?? "").toLowerCase();
    return {
        reference,
        accountNumber,
        status: ["completed", "successful", "success"].includes(state) ? "completed" : ["failed", "reversed"].includes(state) ? "failed" : "pending",
        amount: { amount: net.plus(fee ?? 0).toFixed(2), currency: text(record.currency) ?? "NGN" },
        fee: fee === null ? null : { amount: fee.toFixed(2), currency: text(record.currency) ?? "NGN" },
        paidAt: text(record.timestamp) || text(record.createdAt) ? new Date((text(record.timestamp) ?? text(record.createdAt))!) : null,
        sender: { name: text(sender.accountName), bankName: text(sender.bankName), bankCode: null, accountNumber: last4(sender.accountNumber) },
    };
};

export default mapFossapayDeposit;
