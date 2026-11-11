import { randomUUID } from "crypto";
import { PROVIDER_ENVIRONMENT } from "@/constants/crypto";
import { PROVIDER_SEND_STATUS } from "@/constants/cryptoPurchases";
import { CryptoSendProvider } from "../../cryptoSendProvider";
import { ProviderSend, ProviderSendableAsset } from "../../types";

const ASSETS: ProviderSendableAsset[] = [
    { providerAssetId: "USDT:trx", providerCode: "USDT", symbol: "USDT", providerNetwork: "trx", terms: { fee: "1", minAmount: "1", precision: 6, memoRequired: false, isEnabled: true } },
    { providerAssetId: "USDT:bsc", providerCode: "USDT", symbol: "USDT", providerNetwork: "bsc", terms: { fee: "0.3", minAmount: "1", precision: 6, memoRequired: false, isEnabled: true } },
];

/**
 * A pretend sender for local development and e2e runs (KuCoin has no
 * sandbox). Sandbox only; nothing leaves the machine. A send is pending until
 * it's first looked up, then completed with a made-up hash — so the app sees
 * the full "sending → sent" cycle. Sends live in memory: after a restart
 * they're unknown, which exercises the needs_review path.
 * Stock comes from FAKE_CRYPTO_STOCK (default 100000).
 */
class FakeCryptoSendProvider implements CryptoSendProvider {
    readonly name = "fakesend";
    readonly environment = PROVIDER_ENVIRONMENT.SANDBOX;
    private readonly sends = new Map<string, ProviderSend>();

    async listSendableAssets() {
        return ASSETS;
    }

    async getSendTerms({ providerAssetId }: { providerAssetId: string }) {
        const asset = ASSETS.find((candidate) => candidate.providerAssetId === providerAssetId);
        if (!asset) throw new Error(`fakesend: unknown asset ${providerAssetId}`);
        return asset.terms;
    }

    async getBalance() {
        return process.env.FAKE_CRYPTO_STOCK ?? "100000";
    }

    async send({ externalId, amount }: { externalId: string; providerAssetId: string; address: string; memo: string | null; amount: string }) {
        const existing = this.sends.get(externalId);
        if (existing) return existing;
        const sent: ProviderSend = { externalId, providerReference: `fake-${randomUUID()}`, status: PROVIDER_SEND_STATUS.PENDING, amount, fee: null, txHash: null, failureReason: null };
        this.sends.set(externalId, sent);
        return sent;
    }

    async getSend({ externalId }: { externalId: string; providerReference: string | null; providerAssetId: string }) {
        const sent = this.sends.get(externalId);
        if (!sent) return null;
        const done: ProviderSend = { ...sent, status: PROVIDER_SEND_STATUS.COMPLETED, fee: "0", txHash: `0xfake${externalId.replace(/-/g, "")}` };
        this.sends.set(externalId, done);
        return done;
    }
}

export default FakeCryptoSendProvider;
