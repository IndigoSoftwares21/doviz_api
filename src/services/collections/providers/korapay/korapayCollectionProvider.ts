import { COLLECTION_PROVIDER_ERROR_CODE, FEE_BEARER } from "@/constants/nairaDeposits";
import { ProviderEnvironment } from "@/constants/crypto";
import { WebhookRequest } from "@/services/crypto/cryptoProvider";
import { CollectionProvider } from "../../collectionProvider";
import CollectionProviderError from "../../collectionProviderError";
import { CreateBankTransferArgs, ProviderBankTransfer, ProviderBankTransferCreated } from "../../types";
import KORAPAY from "./constants";
import KorapayClient from "./korapayClient";
import { KorapayBankTransferCharge, KorapayCharge } from "./korapayTypes";
import mapKorapayBankTransfer from "./mapKorapayBankTransfer";
import mapKorapayCharge from "./mapKorapayCharge";
import verifyKorapayWebhook from "./verifyKorapayWebhook";
import parseKorapayWebhook from "./parseKorapayWebhook";

/** Korapay one-time bank transfer accounts behind the neutral CollectionProvider interface. */
class KorapayCollectionProvider implements CollectionProvider {
    readonly name = KORAPAY.PROVIDER_NAME;
    readonly environment: ProviderEnvironment;
    private readonly client: KorapayClient;

    constructor({ client }: { client?: KorapayClient } = {}) {
        this.client = client ?? new KorapayClient();
        this.environment = this.client.config.environment;
    }

    /** `merchant_bears_cost: false` puts Korapay's fee on the payer (it's in `amount_expected`). */
    async createBankTransfer({ externalId, amount, feeBearer, customer, narration }: CreateBankTransferArgs): Promise<ProviderBankTransferCreated> {
        const email = customer.email ?? this.client.config.fallbackCustomerEmail;
        if (!email) {
            throw new CollectionProviderError({
                code: COLLECTION_PROVIDER_ERROR_CODE.CONFIGURATION,
                status: null,
                providerMessage: "Korapay needs a customer email: set KORAPAY_FALLBACK_CUSTOMER_EMAIL for users without one",
            });
        }

        const charge = await this.client.request<KorapayBankTransferCharge>({
            method: "POST",
            path: "/charges/bank-transfer",
            body: {
                reference: externalId,
                amount: Number(amount.amount),
                currency: amount.currency,
                customer: { email, ...(customer.name ? { name: customer.name } : {}) },
                narration,
                merchant_bears_cost: feeBearer === FEE_BEARER.DOVIZ,
                ...(this.client.config.webhookUrl ? { notification_url: this.client.config.webhookUrl } : {}),
            },
        });

        return mapKorapayBankTransfer({ externalId, amount, feeBearer, charge });
    }

    /** Korapay looks charges up by the reference WE sent (our deposit id). */
    async getBankTransfer({ externalId }: { externalId: string; providerReference: string | null }): Promise<ProviderBankTransfer | null> {
        try {
            const charge = await this.client.request<KorapayCharge>({ method: "GET", path: `/charges/${encodeURIComponent(externalId)}` });
            return charge ? mapKorapayCharge({ externalId, charge }) : null;
        } catch (error) {
            if (error instanceof CollectionProviderError && error.code === COLLECTION_PROVIDER_ERROR_CODE.NOT_FOUND) return null;
            throw error;
        }
    }

    verifyWebhook(request: WebhookRequest) {
        return verifyKorapayWebhook({ request, secretKey: this.client.config.secretKey });
    }

    parseWebhook(body: unknown) {
        return parseKorapayWebhook({ body });
    }

    /** Korapay sends no "is this URL alive?" pings. */
    isWebhookPing() {
        return false;
    }
}

export default KorapayCollectionProvider;
