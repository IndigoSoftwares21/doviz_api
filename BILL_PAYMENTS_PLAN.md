# Bill Payments (provider-agnostic; Flutterwave first)

Status: **phases 1–4 done** — users can browse, validate and pay bills from
their naira balance (`POST /bills/payments`, `GET /bills/payments[/{id}]`),
settled/refunded via webhook (`POST /webhooks/flutterwave`), a 2-minute
reconciler and refresh-on-read. Money path verified against Postgres
(`tests/bills/billPayment.integration.test.ts`) and end to end over HTTP.
**Blocked for live payments:** Flutterwave IP whitelisting (until then every
payment is refused as a setup problem and refunded at once).

**To verify once whitelisted:** the pay response's `tx_ref`, that
`GET /bills/{ref}` finds payments by our reference, and the bill webhook body
(which field echoes our reference). Until confirmed, a payment Flutterwave
acknowledged is never auto-refunded — only flagged.

## 1. The product
Users pay bills from their in-app balance: airtime, data, electricity, cable TV,
internet. The mobile app's Pay Bills sheet already shows the first four.

**Hard rule: switching bill provider never needs an app change.** The app only
talks to our `/bills` endpoints and only ever sees Doviz ids. Provider names,
codes and status strings live inside `src/services/bills/providers/<name>/`.

## 2. Provider interface
`src/services/bills/billProvider.ts` — `BillProvider`:

| Method | Does |
|---|---|
| `listCatalog()` | Every biller + product the provider sells, **raw** (no matching or renaming) |
| `validateCustomer({ providerProductRef, customerId })` | Name/address on a meter, smartcard, etc. |
| `payBill({ externalId, providerProductRef, customerId, amount })` | Starts a payment. `externalId` = our `bill_payments.id`, sent as the provider's reference |
| `getBillPayment({ externalId, providerReference })` | Looks a payment up by OUR id or the provider's ref (works after a timed-out request) |

- Money is always `{ amount, currency }` with decimal **strings** — never a JS
  number, never a hardcoded NGN.
- Errors are `BillProviderError` with a neutral code: only `rejected` means
  "definitely not charged"; `unavailable` / `invalid_response` = outcome unknown.
- Statuses are ours: `pending | completed | failed`. Each provider maps its own
  (Flutterwave: `"success"` and `"successful"` → `completed`).
- `billProviderRegistry.active()` reads `BILLS_PROVIDER`. Every payment stores the
  provider that handled it, so an in-flight payment finishes with that provider
  after a switch.

## 3. Catalog — what is ours vs. the provider's

| Thing | Same across providers? | Stored as |
|---|---|---|
| Categories (airtime, data, electricity, cable_tv, internet) | Yes | `bill_categories`, fixed list we own |
| Billers (MTN, Ikeja Electric, DStv) | Yes — real companies | `billers` (ours: name, logo, `match_keywords`; 26 seeded) + `biller_provider_refs` (each provider biller, raw, with a reviewed link) |
| Products (data bundles, cable plans) | **No** — sizes, validity, prices differ | `bill_products`, **one set per provider** |
| Airtime / electricity | Effectively yes | One `range` product per biller per provider |

**Matching and naming are shared, provider-independent code** (`src/services/bills/catalog/`),
driven by data, so a new provider needs no matching code:
- `npm run bills:sync [-- <provider>]` records every provider biller and
  **suggests** a link to one of our billers (keyword + inferred category), with
  the reason. Ambiguous or unknown billers (tax, courier, dealer) stay unlinked.
- `npm run bills:review` lists suggestions; `confirm <id>` / `confirm all-suggested`,
  `link <id> <slug>`, `ignore <id>` / `ignore all-unmatched`. **Only confirmed
  links reach the app.** Re-syncs never change reviewed links.
- Product names: `provider_name` (raw, audit) → `name` (auto-cleaned:
  "AIRTEL 1.3GB data bundle" → "1.3GB", "IKEDC  PREPAID" → "Prepaid") →
  `display_name` (manual override, never touched by sync). App shows
  `coalesce(display_name, name)`. Validity days parsed from names.
- Duplicates are disabled on first insert; `is_available` (sync) and
  `is_enabled` (ours) are separate, so syncing never undoes a manual disable.
- Range products with no provider limits get `BILL_RANGE_DEFAULTS` per category.
- Logos are ours (`billers.logo_url`); a provider logo only fills a missing one on confirm.
- The app lists only the **active** provider's products. Old payments keep
  pointing at their original product rows, so history stays correct.
- Switching: `bills:sync -- <new>` → `bills:review` → set `BILLS_PROVIDER`.

## 4. Payment flow
1. `GET /bills/categories`, `GET /bills/billers?category=`, `GET /bills/products?billerId=` — our tables only.
2. `POST /bills/validate` `{ productId, customerId }` (skipped for airtime/data).
3. `POST /bills/payments` `{ productId, customerId, amount, idempotencyKey }` + transaction PIN.
   One DB transaction: insert `bill_payments` (`pending`) + **hold**:
   `user_available −total`, `bills_in_transit(provider) +total`. The ledger's
   no-overdraft rule rejects insufficient balance.
4. After commit: `provider.payBill({ externalId: billPayment.id, … })`.
5. `syncBillPayment` always **re-fetches from the provider** (never trusts a webhook body):
   - `completed` → **settle**: `bills_in_transit −total`, `provider_clearing(provider) +cost`,
     `bill_revenue +(total − cost)`; store token; notify user.
   - `failed` → **reversal**: full hold back to the user.
6. Timeout / unclear error → `processing`. **Never refund on a guess**: refund only
   when the provider says failed, or still can't find the payment after a grace period.

## 5. Webhooks
- Reuse `POST /webhooks/:provider`. Add a small webhook registry keyed by provider
  name (`verify`, `parse`, `isPing`) so one Flutterwave verifier can serve bills
  now and payouts later.
- New `WEBHOOK_RESOURCE_TYPE.BILL_PAYMENT` → `processWebhookEvent` → `syncBillPayment`.
- Flutterwave bill webhooks have no `data.id`: event id = `${tx_ref}:${status}`.
  Verified by the `verif-hash` header (constant-time compare).
- `reconcile-bill-payments` job every 2 min over `pending`/`processing` payments.

## 6. Database (phase 1 migration)
- `bill_categories`, `billers`, `biller_provider_refs`, `bill_products`, `bill_payments`.
- `bill_payments`: final statuses can't change, amounts/links immutable, no deletes,
  unique `(user_id, idempotency_key)`, unique `(provider, provider_reference)`.
- Ledger: account kinds `bills_in_transit` (per provider), `bill_revenue`;
  transaction types `bill_hold`, `bill_settle`, `bill_reversal`.
- `money_amount` domain (same 2-decimal rule as `naira_amount`, currency-neutral
  name) for the new tables. `createLedgerPosting` takes a `currency`.
- Users only hold NGN today, so products in another currency are hidden until
  that currency (or FX) exists.

## 7. Phases
1. **Foundation** — migration, constants, interface, types, registry, ledger
   currency param, fake provider + tests.
2. **Flutterwave** — client, mappers, catalog sync; unit tests on recorded responses.
3. **Read endpoints** — catalog + validate, OpenAPI docs.
4. **Payment** — pay endpoint, `syncBillPayment` (hold/settle/refund), webhook
   dispatch, reconciler.
5. **Switch test** — one contract suite every `BillProvider` must pass; a second
   fake provider proves a switch works.
6. **Mobile** — wire `PayBillsSheet` to `/bills`.

## 8. Open decisions
1. **Pricing**: face value + keep provider commission, or add a service fee?
   (`bill_products.service_fee` exists, default 0.)
2. **Float**: bills are paid from Doviz's Flutterwave wallet; crypto naira lands at
   Breet. Who tops up Flutterwave, and how is the transfer booked in the ledger?
   Plan: low-balance alert + block new payments when the float can't cover them.
3. **Flutterwave setup**: KYC done, fixed outbound IP whitelisted in production.
   Nigeria only.
4. **Electricity tokens**: stored on `bill_payments.token` so users can view them again.

## 9. Flutterwave reference (v3, `https://api.flutterwave.com/v3`, `Authorization: Bearer <secret>`)
**Decision: Flutterwave v3.** v4 has no bills API (checked the v4 reference
index, Nov 2026). Env: `FLUTTERWAVE_BASE_URL`, `FLUTTERWAVE_ENV`,
`FLUTTERWAVE_SECRET_KEY` (`FLWSECK_TEST-...` in sandbox), `FLUTTERWAVE_WEBHOOK_HASH`
(checked against the `verif-hash` header).

- Items: `GET /billers/{biller_code}/items`
- Validate: `GET /bill-items/{item_code}/validate?code={biller_code}&customer=`
- Pay: `POST /billers/{biller_code}/items/{item_code}/payment` `{ country, customer_id, amount, reference, callback_url }`
  — `amount` must equal the item amount for fixed items; duplicate `reference` → 400.
- Status: `GET /bills/{reference}` — token in `data.extra` (short form: `data.token`);
  don't rely on `recharge_token`.
- Webhook: `event: "singlebillpayment.status"`, header `verif-hash`, return 200 within 60s.
- Catalog: `GET /bill-categories?country=NG` (verified, works without IP whitelisting):
  a FLAT item list — `biller_code`, `name` (= biller), `biller_name` (= item),
  `item_code`, `amount` (0 = any amount), `fee`, `is_airtime`, `label_name`.
  Items repeat (newest id wins); item codes repeat across billers, so our
  product ref is `"<biller_code>:<item_code>"`.
- Every other bill endpoint returns "Please enable IP Whitelisting" until the
  server IP is whitelisted in the dashboard — validate / pay / status shapes are
  from the docs until verified there.
