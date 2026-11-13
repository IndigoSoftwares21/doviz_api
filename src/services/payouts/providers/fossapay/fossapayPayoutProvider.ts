import Decimal from "decimal.js";
import monitoring from "@/utils/monitoring";
import toBankSlug from "@/utils/banks/toBankSlug";
import FossapayClient, { FossapayReply } from "@/services/fossapay/fossapayClient";
import { PayoutProvider } from "../../payoutProvider";
import PayoutProviderError from "../../payoutProviderError";
import { PayoutMoney, ProviderPayoutBank } from "../../types";
import { PAYOUT_PROVIDER_ERROR_CODE } from "@/constants/withdrawals";
import mapFossapayPayout from "./mapFossapayPayout";
import fossapayPayoutFee from "./fossapayPayoutFee";

const ok = (reply: FossapayReply) => reply.status !== null && reply.status >= 200 && reply.status < 300;
const message = (reply: FossapayReply) => (reply.status === null ? reply.code : String(reply.data.message ?? "no message"));
const dataOf = (reply: FossapayReply) => ("data" in reply ? ((reply.data.data ?? reply.data) as Record<string, unknown>) : {});

/**
 * Withdrawals paid from the Fossapay MASTER wallet — the one pool that backs
 * every user's Ziks balance (deposits are swept into it). Our withdrawal id is
 * both the reference and the idempotency key, so a retried send can never pay
 * twice. Production only (Fossapay has no sandbox).
 */
class FossapayPayoutProvider implements PayoutProvider {
    readonly name = "fossapay";
    readonly environment = "production" as const;
    private banks: ProviderPayoutBank[] | null = null;

    constructor(private readonly client: FossapayClient) {}

    async listBanks() {
        const reply = await this.client.get("/transfers/fiat/banks");
        if (!ok(reply)) throw this.error("bank list", reply);
        const list = "data" in reply ? reply.data.data : null;
        const rows = (Array.isArray(list) ? list : []) as Record<string, unknown>[];
        this.banks = rows
            .filter((row) => typeof row.bankcode === "string" && typeof row.bankname === "string")
            .map((row) => ({ providerBankId: String(row.bankcode), name: String(row.bankname), slug: toBankSlug({ value: String(row.bankname) }), code: String(row.bankcode) }));
        return this.banks;
    }

    async resolveAccount({ providerBankId, accountNumber }: { providerBankId: string; accountNumber: string }) {
        const reply = await this.client.post("/transfers/fiat/bank-name-enquiry", { bankCode: providerBankId, accountNumber });
        if (!ok(reply)) throw this.error("name enquiry", reply);
        const name = String(dataOf(reply).accountName ?? "").trim();
        if (!name) throw new PayoutProviderError({ code: PAYOUT_PROVIDER_ERROR_CODE.REJECTED, status: reply.status, providerMessage: "No account name" });
        return { accountName: name };
    }

    async sendPayout({ externalId, providerBankId, accountNumber, accountName, amount, narration }: Parameters<PayoutProvider["sendPayout"]>[0]) {
        const bankName = (this.banks ?? (await this.listBanks())).find((bank) => bank.providerBankId === providerBankId)?.name ?? providerBankId;
        const body = {
            amount: Number(new Decimal(amount.amount).toFixed(2)),
            currency: amount.currency,
            reference: externalId,
            destinationBankCode: providerBankId,
            destinationBankName: bankName,
            destinationAccountName: accountName,
            destinationAccountNumber: accountNumber,
            remarks: narration.slice(0, 100),
        };
        const reply = await this.client.post("/payouts", body, { "X-Idempotency-Key": externalId });
        if (ok(reply)) return mapFossapayPayout({ externalId, record: dataOf(reply), currency: amount.currency });
        // Already sent (a retry, or a lost reply): return that payout — never treat it as refused.
        const existing = reply.status === 409 || reply.status === null || (reply.status ?? 0) >= 500 ? await this.getPayout({ externalId }) : null;
        if (existing) return existing;
        throw this.error("payout", reply);
    }

    async getPayout({ externalId }: { externalId: string }) {
        const reply = await this.client.get(`/payouts/reference/${encodeURIComponent(externalId)}`);
        if (reply.status === 404) return null;
        if (!ok(reply)) throw this.error("payout lookup", reply);
        return mapFossapayPayout({ externalId, record: dataOf(reply), currency: "NGN" });
    }

    /** Exact, from Fossapay's tiered schedule — so each withdrawal reserves the right fee, small or large. */
    async quoteFee({ amount }: { amount: PayoutMoney }): Promise<PayoutMoney> {
        return { amount: fossapayPayoutFee({ amount: amount.amount }), currency: amount.currency };
    }

    async getBalance({ currency }: { currency: string }): Promise<PayoutMoney | null> {
        const reply = await this.client.get("/wallets/fiat/master");
        if (!ok(reply)) return null;
        const available = dataOf(reply).availableBalance;
        return available === undefined || available === null ? null : { amount: new Decimal(String(available)).toFixed(2), currency };
    }

    private error(step: string, reply: FossapayReply) {
        const text = message(reply);
        const code =
            reply.status === null || reply.status >= 500 || reply.status === 429 || /insufficient/i.test(text) ? PAYOUT_PROVIDER_ERROR_CODE.UNAVAILABLE
            : reply.status === 401 || reply.status === 403 ? PAYOUT_PROVIDER_ERROR_CODE.CONFIGURATION
            : reply.status === 404 ? PAYOUT_PROVIDER_ERROR_CODE.NOT_FOUND
            : PAYOUT_PROVIDER_ERROR_CODE.REJECTED;
        if (/insufficient/i.test(text)) monitoring.error(`Fossapay master wallet can't cover a ${step} — top up the float`, new Error(text));
        return new PayoutProviderError({ code, status: reply.status, providerMessage: text });
    }
}

export default FossapayPayoutProvider;
