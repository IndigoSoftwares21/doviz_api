# Naira Deposits (provider-agnostic; Korapay first)

Status: **plan** — nothing built yet.

## 1. The product
Users top up their naira balance by bank transfer. They enter an amount; we show
a **one-time account number** (valid ~30 min) and the exact amount to send; the
transfer lands, the balance is credited. No dedicated account per user (no BVN
step, no unsolicited money to reconcile). This balance funds swaps, bills and
(later) crypto buys; withdrawals to the user's linked bank are a separate plan
(Korapay payouts behind the existing `PayoutProvider`).

**Hard rule (same as bills): switching provider never needs an app change.** The
app sees `{ accountName, accountNumber, bankName, expiresAt }` and Doviz ids —
never a provider name, code or status string. Pattern proven in Sabi Vendor's
`StorefrontPaymentProvider` (Korapay + Paystack behind one `initiateBankTransfer`).

## 2. Fees — the provider's own fee, passed through; user pays by default
No fee schedule of ours, no script: the fee is whatever the provider charges for
that transfer, and it's dynamic per provider and per amount.

- One toggle: `NAIRA_DEPOSIT_FEE_BEARER` = `user` (default) | `doviz`.
- We pass the bearer to the provider when creating the transfer; the provider
  returns its fee and the exact amount to send (Korapay: `merchant_bears_cost`
  → `fee`, `amount_expected`).
  - `user`: user wants ₦50,000 → provider says send ₦50,000 + its fee → we credit ₦50,000.
  - `doviz`: user sends ₦50,000 → we credit ₦50,000; the provider takes its fee from our settlement.
- Each deposit **snapshots** `fee_bearer` and the provider's quoted `fee`, so
  flipping the toggle never changes an open deposit. The fee actually charged is
  re-read from the provider at credit time (`provider_fee`).
- A provider that can't put the fee on the customer is rejected at registration
  when the bearer is `user` (never silently absorbed).
- The fee is shown on the account card ("Send ₦50,375 — includes ₦375 transfer fee")
  before the user pays; not paying just lets the account expire.
- Min/max deposit (₦100 / ₦5,000,000): constants in `src/constants/nairaDeposits.ts`.

## 3. Provider interface
`src/services/collections/collectionProvider.ts` — `CollectionProvider`:

| Method | Does |
|---|---|
| `createBankTransfer({ externalId, amount, feeBearer, customer: { name, email }, narration })` | One-time account. `externalId` = our `naira_deposits.id`, sent as the provider reference. Returns `{ providerReference, bankAccount: { accountName, accountNumber, bankName }, amountToTransfer, fee, expiresAt }`. Idempotent on `externalId`. |
| `getBankTransfer({ externalId, providerReference })` | Provider's OWN record: `{ status: pending\|completed\|expired\|failed, amountPaid, providerFee, paidAt }` or `null`. |
| `verifyWebhook` / `parseWebhook` / `isWebhookPing` | Same contract as bills/crypto; deposit events → resourceType `naira_deposit`, resourceId = our id or provider ref. |

- Money is `{ amount, currency }` decimal strings (reuse `services/bills/types` `Money`).
- Errors: `CollectionProviderError` with neutral codes (`rejected`, `unavailable`, `invalid_response`).
- `collectionProviderRegistry.active()` returns an **ordered list** from
  `NAIRA_COLLECTION_PROVIDERS` (e.g. `korapay,paystack`): creation tries the next
  provider only on `unavailable` before anything was created. Each deposit stores
  its provider; it finishes with that provider.
- `findWebhookReceiver` checks the collection registry too. When Korapay later also
  does payouts, it's ONE class implementing both interfaces, registered once.

## 4. Deposit flow
1. (No quote endpoint — the provider's fee is only known once the transfer is created.)
2. `POST /naira-deposits` `{ amount, idempotencyKey }` → insert `naira_deposits`
   (`pending`, `fee_bearer` snapshot) → after commit `provider.createBankTransfer`
   → store account details, `fee`, `amount_to_transfer`, `expires_at` → return
   `{ id, status, bankAccount, amountToTransfer, amountToCredit, fee, expiresAt }`.
   Provider failure before creation → row `failed`, 502 with a friendly message.
   No money moves at creation, so there's nothing to hold or refund.
3. Webhook / reconciler / refresh-on-read → `syncNairaDeposit` **re-fetches from the
   provider** (never trusts the body), then in one DB transaction, row locked:
   - `completed` → **credit** (§6), status `completed`, realtime `WALLET_BALANCE_CHANGED`
     + `NAIRA_DEPOSIT_UPDATED`, audit log, notification.
   - `expired` / `failed` with nothing paid → status `expired` / `failed`.
   - still `pending` → bump `last_checked_at`.
4. `GET /naira-deposits/:id` (refresh-on-read for open ones), `GET /naira-deposits` (history, limit/offset).
5. Statement: `describeStatementEntry` learns `naira_deposit`.

**Edge cases**
- **Paid after expiry**: providers still settle → the reconciler keeps checking
  `expired` deposits for `LATE_PAYMENT_WINDOW` (24h) and credits them.
- **Wrong amount**: handled by the provider (it refunds the sender / doesn't
  complete the charge). We only credit a charge the provider reports `completed`,
  using the amount it says it received.
- **Limits**: ₦100 min, ₦5,000,000 max per deposit, enforced in the POST schema.

## 5. Database (one migration `add_naira_deposits`)
- `naira_deposits`: `id`, `user_id`, `provider`, `provider_reference`,
  `idempotency_key`, `currency`, `amount` (requested credit), `fee` (provider's
  quote), `fee_bearer`, `amount_to_transfer`, `amount_received`, `amount_credited`,
  `provider_fee`, `account_name`, `account_number`, `bank_name`, `expires_at`,
  `status` (`pending|completed|expired|failed`), `failure_reason`,
  `ledger_transaction_id`, `last_checked_at`, `paid_at`, `finalized_at`, timestamps.
  - unique `(user_id, idempotency_key)`, unique `(provider, provider_reference)`, unique `ledger_transaction_id`
  - `completed` ⇔ ledger link set; `completed`/`failed` terminal (`expired` may only → `completed`)
  - amounts, fee snapshot, user, provider immutable; no deletes (guard trigger like `bill_payments`)
  - index on open/expired-within-window rows for the reconciler
- Ledger: account kind `provider_fees` (per provider — fees Doviz absorbed);
  transaction type `naira_deposit`.

## 6. Ledger posting (credit)
Sign convention as `createDepositCredit` (provider_clearing negative = money at
provider). `settled = amount_received − provider_fee` (what reaches our balance):

| Account | Amount |
|---|---|
| `user_available(user)` | `+amount_credited` |
| `provider_clearing(provider)` | `−settled` |
| `provider_fees(provider)` | `−(amount_credited − settled)` — only when Doviz bore the fee |

User bears the fee → `amount_credited = settled`, two entries, Doviz is flat.
Doviz bears it → `amount_credited = amount_received`, the fee lands in
`provider_fees`. Sums to zero either way. Idempotency key `naira-deposit:<id>`.

## 7. Korapay (`src/services/collections/providers/korapay/`)
Base `https://api.korapay.com/merchant/api/v1`, `Authorization: Bearer <secret>`.
Env: `KORAPAY_SECRET_KEY`, `KORAPAY_BASE_URL`, `NAIRA_COLLECTION_PROVIDERS`, `NAIRA_DEPOSIT_FEE_BEARER`.
- Create: `POST /charges/bank-transfer` `{ reference, amount, currency: "NGN", customer: { name, email }, narration, notification_url, merchant_bears_cost: feeBearer === "doviz" }` → `data.{ amount_expected, fee, bank_account.{ account_name, account_number, bank_name, expiry_date_in_utc } }`.
- Status: `GET /charges/{reference}` → `status` (`success|pending|processing|expired|failed`), `amount`, `amount_paid`, `fee`.
- Webhook: `POST /webhooks/korapay`, header `x-korapay-signature` = HMAC-SHA256 of
  `JSON.stringify(body.data)` with the secret key (constant-time compare);
  `event: "charge.success"`, `data.reference`. Event id = `${reference}:${event}`.
- **Verify in sandbox before go-live**: `merchant_bears_cost` behaviour, account
  validity window, how under/over-payment and late payment are reported,
  `amount_paid` vs `amount`.

## 8. Phases
1. **Foundation** — migration + types, constants, `CollectionProvider`, registry,
   credit-split util (pure, unit-tested), fake provider.
2. **Korapay** — client, mappers, webhook verify/parse; tests on recorded responses.
3. **Endpoints** — create, fetch one, list; OpenAPI docs; route tests.
4. **Sync + credit** — `syncNairaDeposit`, `createNairaDepositCredit`, webhook
   dispatch in `processWebhookEvent`, `reconcile-naira-deposits` job (every 2 min);
   ledger integration test against Postgres (both fee bearers, late, under/over).
5. **Mobile** — Add Money sheet: amount → account card (amount to send incl. fee) with copy + countdown → live status via socket.
6. **Next plan** — Korapay payouts (withdraw to linked bank), then buy crypto.

## 9. Decisions
- Fees: provider's own fee, user bears by default (`NAIRA_DEPOSIT_FEE_BEARER`).
- Wrong amounts: the provider's problem; we credit only what it confirms.
- Limits: ₦100 – ₦5,000,000 per deposit.
- No payer-name checks.
- Open: second provider (Paystack, already integrated in Sabi Vendor) as fallback — later.
