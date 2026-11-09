import { CryptoProvider, WebhookRequest } from "../../cryptoProvider";
import BreetClient from "./breetClient";
import { BreetAsset, BreetBank, BreetIntegration, BreetRateQuote, BreetTransaction } from "./breetTypes";
import BREET from "./constants";
import calculateBreetQuote from "./calculateBreetQuote";
import createBreetDepositAddress from "./createBreetDepositAddress";
import findBreetWalletByLabel from "./findBreetWalletByLabel";
import listBreetTransactionsSince from "./listBreetTransactionsSince";
import mapBreetAsset from "./mapBreetAsset";
import mapBreetBank from "./mapBreetBank";
import mapBreetDeposit from "./mapBreetDeposit";
import parseBreetWebhook from "./parseBreetWebhook";
import ProviderError from "./providerError";
import TtlCache from "./ttlCache";
import verifyBreetWebhook from "./verifyBreetWebhook";
import { PROVIDER_ERROR_CODE } from "@/constants/cryptoStatus";
import { ProviderEnvironment } from "@/constants/crypto";

/** Breet behind the neutral CryptoProvider interface. Quirks stay in this folder. */
class BreetProvider implements CryptoProvider {
    readonly name = BREET.PROVIDER_NAME;
    readonly environment: ProviderEnvironment;
    private readonly client: BreetClient;
    private readonly assets: TtlCache<BreetAsset[]>;
    private readonly integration: TtlCache<BreetIntegration>;

    constructor({ client, now = Date.now }: { client?: BreetClient; now?: () => number } = {}) {
        this.client = client ?? new BreetClient();
        this.environment = this.client.environment;
        this.assets = new TtlCache({ ttlMs: BREET.CACHE_TTL_MS, now });
        this.integration = new TtlCache({ ttlMs: BREET.CACHE_TTL_MS, now });
    }

    private rawAssets = () => this.assets.get(() => this.client.request<BreetAsset[]>({ method: "GET", path: "/trades/assets" }));

    async listAssets() {
        return (await this.rawAssets()).map((asset) => mapBreetAsset({ asset }));
    }

    async listBanks() {
        const banks = await this.client.request<BreetBank[]>({ method: "GET", path: "/payments/banks", params: { currency: "ngn" } });
        return banks.map((bank) => mapBreetBank({ bank }));
    }

    async resolveBankAccount({ providerBankId, accountNumber }: { providerBankId: string; accountNumber: string }) {
        const body = { id: providerBankId, accountNumber, currency: "ngn" };
        const result = await this.client.request<{ accountName: string }>({ method: "POST", path: "/payments/banks/validate", body });
        return { accountName: result.accountName };
    }

    createDepositAddress({ providerAssetId, label }: { providerAssetId: string; label: string }) {
        return createBreetDepositAddress({ client: this.client, providerAssetId, label });
    }

    findAddressByLabel({ providerCode, label }: { providerCode: string; label: string }) {
        return findBreetWalletByLabel({ client: this.client, providerCode, label });
    }

    private async codeFor(providerAssetId: string) {
        return (await this.rawAssets()).find((asset) => asset.id === providerAssetId)?.identifier ?? providerAssetId;
    }

    async getDeposit({ reference }: { reference: string }) {
        try {
            const path = `/trades/transactions/${encodeURIComponent(reference)}`;
            const transaction = await this.client.request<BreetTransaction>({ method: "GET", path });
            return mapBreetDeposit({ transaction, providerCode: await this.codeFor(transaction.asset) });
        } catch (error) {
            if (error instanceof ProviderError && (error.code === PROVIDER_ERROR_CODE.NOT_FOUND || error.status === 400)) return null;
            throw error;
        }
    }

    async listRecentDeposits({ since }: { since: Date }) {
        const transactions = await listBreetTransactionsSince({ client: this.client, since });
        return Promise.all(transactions.map(async (transaction) => mapBreetDeposit({ transaction, providerCode: await this.codeFor(transaction.asset) })));
    }

    async getQuote({ providerAssetId, cryptoAmount }: { providerAssetId: string; cryptoAmount: string }) {
        const path = `/trades/pbc/sell/rate-calculator/${encodeURIComponent(providerAssetId)}`;
        const quote = await this.client.request<BreetRateQuote>({ method: "POST", path, body: { amountInUSD: 1, currency: "ngn" } });
        const integration = await this.integration.get(() => this.client.request<BreetIntegration>({ method: "GET", path: "/users/fetch-integration" }));
        return calculateBreetQuote({ quote, cryptoAmount, platformFee: integration.platformFeePercent });
    }

    verifyWebhook(request: WebhookRequest) {
        return verifyBreetWebhook({ request });
    }

    parseWebhook(body: unknown) {
        return parseBreetWebhook({ body });
    }

    isWebhookPing(body: unknown) {
        return (body as { event?: unknown } | null)?.event === BREET.VERIFICATION_EVENT;
    }
}

export default BreetProvider;
