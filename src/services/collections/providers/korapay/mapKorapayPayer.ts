import { ProviderTransferSender } from "../../types";
import { KorapayCharge } from "./korapayTypes";

const clean = (value: string | null | undefined, max: number) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, max) : null;
};

/** Last 4 digits only — we never need (or keep) a full third-party account number. */
const mask = (accountNumber: string | null) => {
    if (!accountNumber) return null;
    const digits = accountNumber.replace(/\D/g, "");
    return digits.length >= 4 ? `******${digits.slice(-4)}` : null;
};

/**
 * Who paid a bank-transfer charge. Korapay sends `payer_bank_account` (at the
 * top level and under `bank_transfer`, Nov 2026) on paid charges; null when
 * neither is there or both are empty.
 */
const mapKorapayPayer = ({ charge }: { charge: KorapayCharge }): ProviderTransferSender | null => {
    const payer = charge.payer_bank_account ?? charge.bank_transfer?.payer_bank_account ?? null;
    if (!payer) return null;

    const sender = {
        name: clean(payer.account_name, 128),
        bankName: clean(payer.bank_name, 128),
        bankCode: clean(payer.bank_code, 16),
        accountNumber: mask(clean(payer.account_number, 32)),
    };
    return Object.values(sender).some((value) => value !== null) ? sender : null;
};

export default mapKorapayPayer;
