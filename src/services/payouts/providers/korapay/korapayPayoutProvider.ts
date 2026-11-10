import Decimal from "decimal.js";
import { ProviderEnvironment } from "@/constants/crypto";
import { PAYOUT_PROVIDER_ERROR_CODE } from "@/constants/withdrawals";
import KorapayClient from "@/services/collections/providers/korapay/korapayClient";
import KORAPAY from "@/services/collections/providers/korapay/constants";
import toBankSlug from "@/utils/banks/toBankSlug";
import { PayoutProvider } from "../../payoutProvider";
import PayoutProviderError from "../../payoutProviderError";
import { PayoutMoney, ProviderPayout } from "../../types";
import { KorapayBalances, KorapayBank, KorapayPayoutRecord, KorapayResolvedAccount } from "./korapayPayoutTypes";
import mapKorapayPayout from "./mapKorapayPayout";
import toPayoutProviderError from "./toPayoutProviderError";

const isNotFound = (error: PayoutProviderError) =>
    error.code === PAYOUT_PROVIDER_ERROR_CODE.NOT_FOUND || /not found/i.test(error.providerMessage ?? "");

/**
 * Korapay payouts (NGN bank transfers) behind the neutral PayoutProvider. Shares
 * the Korapay client, keys and webhook URL with Korapay collections; payout
 * webhooks (transfer.*) arrive through that receiver. No beneficiaries needed
 * for NGN. Korapay can't quote a fee before sending — it reports it in the
 * disburse response, the lookup and the webhook.
 */
class KorapayPayoutProvider implements PayoutProvider {
    readonly name = KORAPAY.PROVIDER_NAME;
    readonly environment: ProviderEnvironment;
    /** Korapay refuses NGN payouts outside this ("You can only transfer an amount between NGN 1000 and NGN 10000000", sandbox). */
    readonly limits = { minAmount: "1000.00", maxAmount: "10000000.00" };
    private readonly client: KorapayClient;

    constructor({ client }: { client?: KorapayClient } = {}) {
        this.client = client ?? new KorapayClient();
        this.environment = this.client.config.environment;
    }

    private async call<T>(request: Parameters<KorapayClient["request"]>[0]) {
        try {
            return await this.client.request<T>(request);
        } catch (error) {
            throw toPayoutProviderError({ error });
        }
    }

    async listBanks() {
        const banks = await this.call<KorapayBank[]>({ method: "GET", path: "/misc/banks?countryCode=NG", useKey: "public" });
        return (banks ?? []).map((bank) => ({
            providerBankId: bank.code,
            name: bank.name.trim(),
            slug: toBankSlug({ value: bank.slug || bank.name }),
            code: /^[0-9]{3,6}$/.test(bank.code) ? bank.code : null,
        }));
    }

    async resolveAccount({ providerBankId, accountNumber }: { providerBankId: string; accountNumber: string }) {
        const result = await this.call<KorapayResolvedAccount>({
            method: "POST",
            path: "/misc/banks/resolve",
            body: { bank: providerBankId, account: accountNumber, currency: KORAPAY.CURRENCY },
        });
        return { accountName: result.account_name.trim() };
    }

    async sendPayout({
        externalId,
        providerBankId,
        accountNumber,
        amount,
        narration,
        customer,
    }: Parameters<PayoutProvider["sendPayout"]>[0]): Promise<ProviderPayout> {
        const email = customer.email || this.client.config.fallbackCustomerEmail;
        if (!email) throw new PayoutProviderError({ code: PAYOUT_PROVIDER_ERROR_CODE.CONFIGURATION, status: null, providerMessage: "No customer email or KORAPAY_FALLBACK_CUSTOMER_EMAIL" });

        try {
            const record = await this.call<KorapayPayoutRecord>({
                method: "POST",
                path: "/transactions/disburse",
                body: {
                    reference: externalId,
                    // No notification_url: Korapay's disburse rejects it ("One or more fields are
                    // invalid", verified in sandbox). Payout webhooks come from the dashboard URL.
                    destination: {
                        type: "bank_account",
                        amount: Number(new Decimal(amount.amount).toFixed(2)),
                        currency: amount.currency,
                        narration,
                        bank_account: { bank: providerBankId, account: accountNumber },
                        customer: { name: customer.name, email },
                    },
                },
            });
            return mapKorapayPayout({ externalId, record: record ?? {}, currency: amount.currency });
        } catch (error) {
            // A retry of a payout Korapay already has: return it, never treat it as refused.
            if (error instanceof PayoutProviderError && /duplicate/i.test(error.providerMessage ?? "")) {
                const existing = await this.getPayout({ externalId });
                if (existing) return existing;
                throw new PayoutProviderError({ code: PAYOUT_PROVIDER_ERROR_CODE.UNAVAILABLE, status: error.status, providerMessage: error.providerMessage });
            }
            throw error;
        }
    }

    async getPayout({ externalId }: { externalId: string }) {
        try {
            const record = await this.call<KorapayPayoutRecord>({ method: "GET", path: `/transactions/${encodeURIComponent(externalId)}` });
            return record ? mapKorapayPayout({ externalId, record, currency: KORAPAY.CURRENCY }) : null;
        } catch (error) {
            if (error instanceof PayoutProviderError && isNotFound(error)) return null;
            throw error;
        }
    }

    async getBalance({ currency }: { currency: string }): Promise<PayoutMoney | null> {
        const balances = await this.call<KorapayBalances>({ method: "GET", path: "/balances" });
        const available = balances?.[currency]?.available_balance;
        if (available === null || available === undefined) return null;
        return { amount: new Decimal(available).toFixed(2), currency };
    }
}

export default KorapayPayoutProvider;
