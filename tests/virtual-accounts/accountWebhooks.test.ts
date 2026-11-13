import { createHmac } from "crypto";
import { parseFossapayWebhook, verifyFossapayWebhook } from "@/services/virtualAccounts/providers/fossapay/fossapayWebhooks";
import mapFossapayDeposit from "@/services/virtualAccounts/providers/fossapay/mapFossapayDeposit";
import { parseSquadWebhook, verifySquadWebhook } from "@/services/virtualAccounts/providers/squad/squadWebhooks";
import mapSquadDeposit from "@/services/virtualAccounts/providers/squad/mapSquadDeposit";

const fossapayDeposit = {
    transactionId: "txn_1",
    customerId: "c-1",
    sender: { accountName: "JOHN DOE", accountNumber: "0123456789", bankName: "GTBank" },
    recipient: { accountName: "Ada Okafor", accountNumber: "9912345678", bankName: "Providus" },
    amount: 50000,
    currency: "NGN",
    fee: 500,
    status: "success",
    timestamp: "2026-11-13T15:00:00.000Z",
};

describe("Fossapay webhooks", () => {
    const body = { eventId: "evt_1", eventType: "deposit.completed", timestamp: "2026-11-13T15:00:00Z", data: fossapayDeposit };
    const sign = (secret: string) => createHmac("sha256", secret).update(JSON.stringify(body.data)).digest("hex");

    it("accepts only Fossapay's signature over `data`, with our secret", () => {
        expect(verifyFossapayWebhook({ request: { headers: { "x-fossapay-signature": sign("s3cret") }, body, sourceIp: null }, secret: "s3cret" })).toBe(true);
        expect(verifyFossapayWebhook({ request: { headers: { "x-fossapay-signature": sign("other") }, body, sourceIp: null }, secret: "s3cret" })).toBe(false);
        expect(verifyFossapayWebhook({ request: { headers: { "x-fossapay-signature": sign("s3cret") }, body: { ...body, data: { ...fossapayDeposit, amount: 9_999_999 } }, sourceIp: null }, secret: "s3cret" })).toBe(false);
        expect(verifyFossapayWebhook({ request: { headers: { "x-fossapay-signature": sign("s3cret") }, body, sourceIp: null }, secret: null })).toBe(false);
    });

    it("reads an NGN deposit as an account deposit, and acknowledges other events without acting", () => {
        expect(parseFossapayWebhook(body)).toMatchObject({ eventId: "evt_1", resourceType: "account_deposit", resourceId: "txn_1" });
        expect(parseFossapayWebhook({ ...body, eventType: "payout.completed" })).toMatchObject({ resourceType: "other", resourceId: null });
        expect(parseFossapayWebhook({ ...body, data: { ...fossapayDeposit, currency: "USDT" } })).toMatchObject({ resourceType: "other" });
        expect(parseFossapayWebhook({ nonsense: true })).toBeNull();
    });

    it("maps a transaction: Fossapay's amount is AFTER its fee, so sent = amount + fee (₦500 → {495, 5}, seen live)", () => {
        expect(mapFossapayDeposit({ record: { ...fossapayDeposit, amount: 495, fee: 5 }, unit: "naira" })).toMatchObject({ amount: { amount: "500.00" }, fee: { amount: "5.00" } });
    });

    it("maps a transaction in naira (default) or kobo, masking the sender's account number", () => {
        expect(mapFossapayDeposit({ record: fossapayDeposit, unit: "naira" })).toEqual({
            reference: "txn_1",
            accountNumber: "9912345678",
            status: "completed",
            amount: { amount: "50500.00", currency: "NGN" },
            fee: { amount: "500.00", currency: "NGN" },
            paidAt: new Date("2026-11-13T15:00:00.000Z"),
            sender: { name: "JOHN DOE", bankName: "GTBank", bankCode: null, accountNumber: "******6789" },
        });
        expect(mapFossapayDeposit({ record: fossapayDeposit, unit: "kobo" })).toMatchObject({ amount: { amount: "505.00" }, fee: { amount: "5.00" } });
        expect(mapFossapayDeposit({ record: { ...fossapayDeposit, status: "pending" }, unit: "naira" })).toMatchObject({ status: "pending" });
    });
});

describe("Squad webhooks", () => {
    const body = {
        transaction_reference: "REF2023",
        virtual_account_number: "0123456789",
        principal_amount: "100.00",
        settled_amount: "99.80",
        fee_charged: "0.20",
        currency: "NGN",
        customer_identifier: "zkabc",
        transaction_indicator: "C",
        transaction_date: "2026-11-13T15:00:00.000Z",
        sender_name: "JOHN DOE",
    };
    const hmac = (text: string) => createHmac("sha512", "sk_x").update(text).digest("hex");

    it("accepts the v1 (whole body, any hex case) and v2/v3 (six fields) signatures, nothing else", () => {
        const request = (signature: string, payload: object = body) => ({ headers: { "x-squad-signature": signature }, body: payload, sourceIp: null });
        expect(verifySquadWebhook({ request: request(hmac(JSON.stringify(body)).toUpperCase()), secretKey: "sk_x" })).toBe(true);
        const sixFields = ["REF2023", "0123456789", "NGN", "100.00", "99.80", "zkabc"].join("|");
        expect(verifySquadWebhook({ request: request(hmac(sixFields)), secretKey: "sk_x" })).toBe(true);
        expect(verifySquadWebhook({ request: request(hmac(JSON.stringify(body)), { ...body, principal_amount: "100000.00" }), secretKey: "sk_x" })).toBe(false);
    });

    it("reads a credit as an account deposit, and holds a frozen payment as pending", () => {
        expect(parseSquadWebhook(body)).toMatchObject({ resourceType: "account_deposit", resourceId: "REF2023" });
        expect(mapSquadDeposit(body)).toMatchObject({ status: "completed", amount: { amount: "100.00" }, fee: { amount: "0.20" }, accountNumber: "0123456789" });
        expect(mapSquadDeposit({ ...body, frozen_transaction: { reason: "review" } })).toMatchObject({ status: "pending" });
    });
});
