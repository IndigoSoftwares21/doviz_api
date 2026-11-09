# Crypto Deposits → Naira Balance (provider-agnostic; Breet first)

Status: **in build.** Migrations `20261109133856`…`20261109133928` are applied in dev
and were verified on a throwaway Postgres (§10).

## 1. The product
1. A user gets **deposit addresses** for USDT, USDC, BTC, ETH.
2. They send crypto → the deposit provider (Breet) converts it to naira and credits
   **Doviz's** NGN balance at Breet.
3. Doviz credits the user's **in-app naira balance**, minus **Doviz's markup per
   coin** (e.g. USDT 1%, BTC 2%).
4. Users withdraw naira to their bank — **needs a payout provider (§6), not built yet.**

No crypto balances anywhere: converting on arrival means price swings can't hurt
Doviz. Holding customers' naira is regulated (CBN) — confirm the licensing path
before production.

## 2. Providers (swappable)
Two interfaces; nothing outside `services/crypto/providers/*` knows which provider
is used, and no table or column is named after one.

| Interface | Does | Today |
|---|---|---|
| `CryptoProvider` | assets, deposit addresses, deposits, quotes, bank-name lookup, webhooks | `BreetProvider` (class) |
| `PayoutProvider` | naira to users' banks | **to choose** (§6) |

- `CRYPTO_PROVIDER` picks the provider for **new** addresses; existing addresses keep
  theirs. A user can hold one current address **per coin per provider** (e.g. two
  USDT-TRC20 after a switch, both live); exactly one is **primary** (shown in app).
- Old addresses keep crediting; only a shut-down provider's addresses are `retired`.

## 3. Deposit flow
1. **Get address** (`POST /crypto/wallets`): insert `pending` row with label
   `dvz-<id>` → provider creates the address → `active` + primary. Lost response →
   recover by label. Failure → stays pending; retry reuses the label.
2. **Webhook** (`POST /webhooks/:provider`): verified (Breet: constant-time secret,
   optional IP allowlist) → stored (deduped per provider) → 200 at once.
3. **Sync** (`syncDeposit`): re-fetch the deposit **from the provider** (never trust
   the webhook body) → match our address/asset → lock the deposit row → update status.
4. **Credit** on `completed`, in one DB transaction: current markup for the coin →
   `markup = gross × % (rounded down)`, `net = gross − markup` → ledger posting →
   deposit marked completed **with** the ledger link. No markup configured → no
   credit + alert (never a silent 0%). Gross not in NGN → no credit + alert.
5. **Safety nets:** event sweeper (1 min) and reconciler (10 min, re-checks open
   deposits and the provider's recent list for missed webhooks), each under a
   Postgres advisory lock so only one API instance runs it.

## 4. Ledger (naira, double-entry)
Deposit ₦160,000 gross at 2.5%: user `+156,000.00`, markup revenue `+4,000.00`,
provider clearing (breet) `−160,000.00`.

Enforced by the database: kobo-exact amounts (sub-kobo values are **rejected**,
not rounded); balances change only via entries; each transaction sums to zero at
COMMIT; user balances never negative; ledger history append-only; a deposit
credits at most once and "completed" always means "credited"; credited figures
frozen; money rows never deleted.

## 5. Markup and quotes
- `conversion_markups`: per coin, append-only history with `effective_from`; each
  deposit stores the markup row and % it was credited with.
  Set with `npm run crypto:set-markup -- USDT TRC20 1.0`.
- `GET /crypto/quote`: provider rate (after its own fee) minus our markup, cached
  ~45s, always labelled an estimate. Credit uses the rate at completion.

## 6. Withdrawals — blocked on a payout provider
Breet only pays to banks saved on **Doviz's own** Breet account (**max 3**), with
₦100–₦10,000 per payout and ₦50,000/day. It cannot pay users' banks from an
in-app balance. Needed: a `PayoutProvider` (payout API or the future naira-account
provider) + a treasury step moving naira from Breet to Doviz's bank. The schema
(`bank_withdrawals`: hold → settle/refund via the ledger) is already in place.
Users can already **add and verify** their bank (name must match their legal name).

## 7. API (app, all authenticated, `no-store`)
`GET /crypto/assets` · `GET /crypto/quote` · `POST|GET /crypto/wallets` ·
`GET /wallet/balance` · `GET /wallet/transactions` · `GET /banks` ·
`POST /banks/resolve` · `POST|GET /user/bank-accounts` · `POST /webhooks/:provider`.

## 8. Mobile
Real NGN balance on home (cached for offline "as of"), Receive flow (coin → address
+ QR + copy + network warning + "≈ ₦" estimate), transaction history, add bank.
Withdraw shows "coming soon" until §6.

## 9. Config
`CRYPTO_PROVIDER`, `BREET_BASE_URL`, `BREET_ENV`, `BREET_APP_ID`, `BREET_APP_SECRET`,
`BREET_WEBHOOK_SECRET`, `BREET_PIN`, `BREET_ENFORCE_WEBHOOK_IP` (true in prod, with
correct `TRUST_PROXY`), `JOBS_ENABLED`. Breet dashboard: **holding currency = NGN**.

## 10. Verified (throwaway Postgres)
Deposit credit ₦160,000 − ₦4,000 = ₦156,000; completed-without-credit, double
credit, overdraft, editing balances/history/markups/credited deposits, markup > 20%,
reversed→completed withdrawal, sub-kobo amounts — all rejected; hold + refund works.

## 11. Open with Breet
Asset `id` vs `identifier` · `minimum` units · `Partner_<ref>_` label prefix ·
exact NGN figure on the transaction record (`amount` = NGN after fee in their
example) · webhook payload shapes for pending/deleted/withdrawal events.
