import monitoring from "@/utils/monitoring";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { ProviderVirtualAccount, VIRTUAL_ACCOUNT_ERROR, VirtualAccountCustomer, VirtualAccountProvider, VirtualAccountProviderError } from "../../virtualAccountProvider";
import { parseFossapayWebhook, verifyFossapayWebhook } from "./fossapayWebhooks";
import mapFossapayDeposit from "./mapFossapayDeposit";
import FossapayClient, { FossapayReply } from "./fossapayClient";
import fossapayCustomerFields, { uniqueEmail } from "./fossapayCustomerFields";

const message = (reply: FossapayReply) => (reply.status === null ? reply.code : String(reply.data.message ?? "no message"));
const ok = (reply: FossapayReply): reply is { status: number; data: Record<string, unknown> } => reply.status !== null && reply.status >= 200 && reply.status < 300;

/**
 * Fossapay NGN wallets: a customer (POST /customers), then their wallet
 * (POST /wallets/fiat/create) — a persistent account number. Money paid in
 * stays in that wallet at Fossapay (moving it to our master wallet is part of
 * crediting deposits). Production only: no sandbox exists.
 */
class FossapayVirtualAccountProvider implements VirtualAccountProvider {
    readonly name = "fossapay";
    readonly environment = "production" as const;

    constructor(
        private readonly client: FossapayClient,
        private readonly fallbackEmail: string,
        private readonly country: string,
        private readonly receiving: { webhookSecret: string | null; amountUnit: "naira" | "kobo" } = { webhookSecret: null, amountUnit: "naira" },
    ) {}

    verifyWebhook(request: WebhookRequest) {
        return verifyFossapayWebhook({ request, secret: this.receiving.webhookSecret });
    }

    parseWebhook(body: unknown) {
        return parseFossapayWebhook(body);
    }

    isWebhookPing() {
        return false;
    }

    async getDeposit({ reference }: { reference: string }) {
        const reply = await this.client.get(`/wallets/fiat/transactions/${encodeURIComponent(reference)}`);
        if (reply.status === 404) return null;
        if (!ok(reply)) throw new Error(`Fossapay transaction lookup → ${reply.status ?? "no reply"} (${message(reply)})`);
        return mapFossapayDeposit({ record: (reply.data.data ?? reply.data) as Record<string, unknown>, unit: this.receiving.amountUnit });
    }

    async createAccount(customer: VirtualAccountCustomer): Promise<ProviderVirtualAccount> {
        const email = uniqueEmail({ email: customer.email, fallback: this.fallbackEmail, customerRef: customer.customerRef });
        const created = await this.client.post("/customers", fossapayCustomerFields({ customer, email, country: this.country }));
        if (!ok(created)) this.fail("create customer", created);
        const customerId = String(((created.data.data ?? {}) as Record<string, unknown>).id ?? "");
        if (!customerId) throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.UNAVAILABLE, "Fossapay returned no customer id");

        const wallet = await this.client.post("/wallets/fiat/create", {
            customerId,
            // The account holder's name, as in Fossapay's example ("John Doe").
            walletName: `${customer.firstName} ${customer.lastName}`.slice(0, 100),
            walletReference: customer.customerRef,
        });
        if (!ok(wallet)) this.fail("create wallet", wallet);
        const data = ((wallet.data.data ?? wallet.data) as Record<string, unknown>) ?? {};
        const accountNumber = String(data.accountNumber ?? "");
        if (!/^\d{10}$/.test(accountNumber)) throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.UNAVAILABLE, "Fossapay returned no account number");
        return { accountNumber, accountName: String(data.accountName ?? ""), bankName: String(data.bankName ?? ""), bankCode: data.bankCode ? String(data.bankCode) : null };
    }

    /** 401/403/5xx/timeouts/duplicates are ours to sort out; anything else is the customer's details. */
    private fail(step: string, reply: FossapayReply): never {
        const text = message(reply);
        monitoring.warn(`Fossapay ${step} → ${reply.status ?? "no reply"} (${text})`);
        const ours = reply.status === null || reply.status >= 500 || reply.status === 401 || reply.status === 403 || reply.status === 429 || /duplicate|already|exists/i.test(text);
        if (ours) {
            if (reply.status !== null && reply.status < 500) monitoring.error(`Fossapay ${step} refused (${reply.status}: ${text}) — check FOSSAPAY_API_KEY / reconcile a customer that already exists`, new Error(String(reply.status)));
            throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.UNAVAILABLE, text);
        }
        throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.REJECTED, text);
    }
}

export default FossapayVirtualAccountProvider;
