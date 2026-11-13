import monitoring from "@/utils/monitoring";
import { ProviderVirtualAccount, VIRTUAL_ACCOUNT_ERROR, VirtualAccountCustomer, VirtualAccountProvider, VirtualAccountProviderError } from "../../virtualAccountProvider";
import SquadClient, { SquadReply } from "./squadClient";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { parseSquadWebhook, verifySquadWebhook } from "./squadWebhooks";
import mapSquadDeposit from "./mapSquadDeposit";

/** Squad accounts are GTBank accounts. */
const BANK_NAME = "GTBank";

/** +2348012345678 → 08012345678 (Squad: max 11 digits). */
const localPhone = (e164: string) => (e164.startsWith("+234") ? `0${e164.slice(4)}` : e164.replace(/^\+/, ""));
/** YYYY-MM-DD → MM/DD/YYYY (Squad's format). */
const squadDate = (iso: string) => {
    const [year, month, day] = iso.split("-");
    return `${month}/${day}/${year}`;
};
const message = (reply: SquadReply) => (reply.status === null ? reply.code : String(reply.data.message ?? "no message"));
/** Refusals about OUR merchant account (limits, profiling, permissions) — not the customer. Seen live: "Merchant has reached account opening limit…". */
const MERCHANT_PROBLEM = /merchant|account opening limit|not (been )?profiled|not enabled|not allowed|permission|habaripay support/i;

/**
 * Squad customer virtual accounts (POST /virtual-account): a permanent
 * account number per user, matched by Squad against their BVN. Money sent to
 * it settles to SQUAD_SETTLEMENT_ACCOUNT (or the Squad wallet, T+1, if unset).
 * `customer_identifier` is our opaque customerRef, so a retry after a lost
 * reply finds the account instead of making a second one.
 */
class SquadVirtualAccountProvider implements VirtualAccountProvider {
    readonly name = "squad";

    constructor(
        private readonly client: SquadClient,
        readonly environment: "sandbox" | "production",
        private readonly settlementAccount: string | null,
        private readonly secretKey: string = "",
    ) {}

    verifyWebhook(request: WebhookRequest) {
        return Boolean(this.secretKey) && verifySquadWebhook({ request, secretKey: this.secretKey });
    }

    parseWebhook(body: unknown) {
        return parseSquadWebhook(body);
    }

    isWebhookPing() {
        return false;
    }

    async getDeposit({ reference }: { reference: string }) {
        const reply = await this.client.get(`/virtual-account/merchant/transactions/all?page=1&perPage=1&dir=DESC&transactionReference=${encodeURIComponent(reference)}`);
        if (reply.status === null || reply.status >= 500) throw new Error(`Squad transaction lookup → ${reply.status ?? "no reply"} (${message(reply)})`);
        const rows = ((reply.data.data ?? {}) as { rows?: unknown[] }).rows ?? [];
        const row = rows.find((item) => (item as Record<string, unknown>).transaction_reference === reference) as Record<string, unknown> | undefined;
        return row ? mapSquadDeposit(row) : null;
    }

    async createAccount(customer: VirtualAccountCustomer): Promise<ProviderVirtualAccount> {
        const reply = await this.client.post("/virtual-account", {
            first_name: customer.firstName,
            last_name: customer.lastName,
            middle_name: customer.middleName ?? "",
            mobile_num: localPhone(customer.phoneNumber),
            dob: squadDate(customer.dateOfBirth),
            email: customer.email,
            bvn: customer.bvn,
            gender: customer.gender === "female" ? "2" : "1",
            address: customer.address,
            customer_identifier: customer.customerRef,
            ...(this.settlementAccount ? { beneficiary_account: this.settlementAccount } : {}),
        });
        if (reply.status !== null && reply.status >= 200 && reply.status < 300) return this.toAccount(reply.data);

        // Already created (e.g. our earlier request's reply was lost): fetch it.
        const existing = await this.find(customer.customerRef);
        if (existing) return existing;

        monitoring.warn(`Squad create virtual account → ${reply.status ?? "no reply"} (${message(reply)})`);
        if (reply.status === null || reply.status >= 500 || reply.status === 429) throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.UNAVAILABLE, message(reply));
        if (MERCHANT_PROBLEM.test(message(reply))) {
            monitoring.error(`Squad won't open accounts for our merchant (${reply.status}: ${message(reply)}) — contact Squad/HabariPay to lift the limit or finish profiling`, new Error(String(reply.status)));
            throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.UNAVAILABLE, message(reply));
        }
        if (reply.status === 401 || reply.status === 403) {
            monitoring.error(`Squad refused our key (${reply.status}: ${message(reply)}) — check SQUAD_SECRET_KEY`, new Error(String(reply.status)));
            throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.UNAVAILABLE, message(reply));
        }
        throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.REJECTED, message(reply));
    }

    private async find(customerRef: string) {
        const reply = await this.client.get(`/virtual-account/${encodeURIComponent(customerRef)}`);
        return reply.status === 200 ? this.toAccount(reply.data) : null;
    }

    private toAccount(body: Record<string, unknown>): ProviderVirtualAccount {
        const data = (body.data ?? {}) as Record<string, unknown>;
        const accountNumber = String(data.virtual_account_number ?? "");
        if (!/^\d{10}$/.test(accountNumber)) throw new VirtualAccountProviderError(VIRTUAL_ACCOUNT_ERROR.UNAVAILABLE, "Squad returned no account number");
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
        return { accountNumber, accountName: name, bankName: BANK_NAME, bankCode: data.bank_code ? String(data.bank_code) : null };
    }
}

export default SquadVirtualAccountProvider;
