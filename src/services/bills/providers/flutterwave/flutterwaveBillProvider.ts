import { BILL_PROVIDER_ERROR_CODE, PROVIDER_BILL_STATUS } from "@/constants/bills";
import { ProviderEnvironment } from "@/constants/crypto";
import { BillProvider } from "../../billProvider";
import BillProviderError from "../../billProviderError";
import { Money, ProviderBillPayment, ProviderCustomer } from "../../types";
import FLUTTERWAVE from "./constants";
import FlutterwaveClient from "./flutterwaveClient";
import { parseFlutterwaveProductRef } from "./flutterwaveProductRef";
import { FlutterwaveBillItem, FlutterwaveBillPaymentCreated, FlutterwaveBillStatus, FlutterwaveCustomerValidation } from "./flutterwaveTypes";
import mapFlutterwaveBillPayment from "./mapFlutterwaveBillPayment";
import mapFlutterwaveCatalog from "./mapFlutterwaveCatalog";
import toFlutterwaveMoney from "./toFlutterwaveMoney";

const isNotFound = (error: unknown) =>
    error instanceof BillProviderError &&
    (error.code === BILL_PROVIDER_ERROR_CODE.NOT_FOUND || /not found/i.test(error.providerMessage ?? ""));

/** Flutterwave (v3) behind the neutral BillProvider interface. Quirks stay in this folder. */
class FlutterwaveBillProvider implements BillProvider {
    readonly name = FLUTTERWAVE.PROVIDER_NAME;
    readonly environment: ProviderEnvironment;
    private readonly client: FlutterwaveClient;

    constructor({ client }: { client?: FlutterwaveClient } = {}) {
        this.client = client ?? new FlutterwaveClient();
        this.environment = this.client.environment;
    }

    async listCatalog() {
        const items = await this.client.request<FlutterwaveBillItem[]>({
            method: "GET",
            path: "/bill-categories",
            params: { country: FLUTTERWAVE.COUNTRY },
        });
        return mapFlutterwaveCatalog({ items: items ?? [] });
    }

    async validateCustomer({ providerProductRef, customerId }: { providerProductRef: string; customerId: string }): Promise<ProviderCustomer> {
        const { billerCode, itemCode } = parseFlutterwaveProductRef({ providerProductRef });
        const result = await this.client.request<FlutterwaveCustomerValidation>({
            method: "GET",
            path: `/bill-items/${encodeURIComponent(itemCode)}/validate`,
            params: { code: billerCode, customer: customerId },
        });

        if (result?.response_code && result.response_code !== "00") {
            throw new BillProviderError({
                code: BILL_PROVIDER_ERROR_CODE.REJECTED,
                status: null,
                providerMessage: result.response_message ?? "Customer could not be validated",
            });
        }

        return {
            customerName: result?.name?.trim() || null,
            address: result?.address?.trim() || null,
            minAmount: toFlutterwaveMoney({ value: result?.minimum }),
            maxAmount: toFlutterwaveMoney({ value: result?.maximum }),
        };
    }

    async payBill({
        externalId,
        providerProductRef,
        customerId,
        amount,
    }: {
        externalId: string;
        providerProductRef: string;
        customerId: string;
        amount: Money;
    }): Promise<ProviderBillPayment> {
        if (amount.currency !== FLUTTERWAVE.COUNTRY_CURRENCY[FLUTTERWAVE.COUNTRY]) {
            throw new BillProviderError({ code: BILL_PROVIDER_ERROR_CODE.REJECTED, status: null, providerMessage: `Currency ${amount.currency} not supported` });
        }
        const { billerCode, itemCode } = parseFlutterwaveProductRef({ providerProductRef });

        let created: FlutterwaveBillPaymentCreated;
        try {
            created = await this.client.request<FlutterwaveBillPaymentCreated>({
                method: "POST",
                path: `/billers/${encodeURIComponent(billerCode)}/items/${encodeURIComponent(itemCode)}/payment`,
                body: { country: FLUTTERWAVE.COUNTRY, customer_id: customerId, amount: Number(amount.amount), reference: externalId },
            });
        } catch (error) {
            // A retry of a payment Flutterwave already has: return that payment, never treat it as refused.
            if (error instanceof BillProviderError && /duplicate/i.test(error.providerMessage ?? "")) {
                const existing = await this.getBillPayment({ externalId, providerReference: null });
                if (existing) return existing;
                throw new BillProviderError({ code: BILL_PROVIDER_ERROR_CODE.UNAVAILABLE, status: error.status, providerMessage: error.providerMessage });
            }
            throw error;
        }

        // Flutterwave answers "successful" on creation, but delivery is confirmed only by status/webhook.
        return {
            externalId,
            providerReference: created?.tx_ref || created?.reference || created?.flw_ref || null,
            status: PROVIDER_BILL_STATUS.PENDING,
            amount,
            cost: null,
            token: created?.recharge_token || null,
            failureReason: null,
        };
    }

    async getBillPayment({ externalId, providerReference }: { externalId: string; providerReference: string | null }) {
        // Flutterwave looks bills up by its tx_ref; fall back to our reference when we don't have one yet.
        for (const reference of [providerReference, externalId].filter((value): value is string => Boolean(value))) {
            try {
                const record = await this.client.request<FlutterwaveBillStatus>({
                    method: "GET",
                    path: `/bills/${encodeURIComponent(reference)}`,
                    params: { verbose: 1 },
                });
                if (record) return mapFlutterwaveBillPayment({ externalId, record, requestedAmount: "0.00" });
            } catch (error) {
                if (!isNotFound(error)) throw error;
            }
        }
        return null;
    }
}

export default FlutterwaveBillProvider;
