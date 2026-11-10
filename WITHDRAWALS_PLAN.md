# Withdrawals ("Send Money" to your own bank) — provider-agnostic, Korapay first

Status: **server built** (Korapay payouts, DB-chosen provider, dynamic fee with reserve, withdrawals API, webhooks, reconciler; 10 money-path tests on real Postgres). Mobile Send Money next.

## 1. The product
A user sends naira from their Doviz balance **to a bank account in their own name**:
one of their linked accounts (added via the existing name-matched flow — the bank's
account name must match their legal name). Sending to other people is out of scope.

## 2. Provider-agnostic payouts
`PayoutProvider` (moves to `src/services/payouts/`), implementations under
`providers/<name>/`. Korapay first; Flutterwave later is one more folder.

| Method | Korapay |
|---|---|
| `listBanks()` | `GET /merchant/api/v1/misc/banks?countryCode=NG` |
| `resolveAccount({ bankCode, accountNumber })` | `/merchant/api/v1/misc/banks/resolve` |
| `sendPayout({ externalId, bankCode, accountNumber, amount, narration, customer })` | `POST /merchant/api/v1/transactions/disburse` — `reference` = our withdrawal id |
| `getPayout({ externalId })` | `GET /api/v1/transactions/:reference` |
| `getBalance()` | **optional — Korapay documents none → returns null → float check skipped** |
| webhooks | `transfer.success` / `transfer.failed`, `x-korapay-signature` (HMAC-SHA256 of `JSON.stringify(data)`) — **same URL and receiver as Korapay deposits** (`charge.*`) |

- Beneficiaries are **not** needed for NGN API payouts (that page is USD/international).
- `customer.email` is required by Korapay: the user's verified email, else the
  fallback **`info@fufusoftwareslimited.org`**.
- Korapay: never treat 500/502/503/504 as failed — verify first (matches our rule).

## 3. Active provider from the database
- `provider_settings` (`service = 'payouts'` → `active_provider`, changed_by, changed_at)
  + an audit log per change. Read for each **new** withdrawal — a switch needs no restart.
- `npm run payouts:use -- <provider>` refuses an unconfigured provider or one whose
  banks aren't synced.
- **Mid-flight swaps are safe:** each withdrawal stores its provider and holds its money
  under that provider's `payouts_in_transit` account; sending, webhooks, follow-up
  checks, reconciler, settle and refund all use **the row's provider**, never the
  active one. A swap only affects withdrawals started after it.
- Banks are ours (`payout_banks`, matched by slug); each provider maps them
  (`provider_banks`). No mapping for the user's bank on the active provider →
  "Withdrawals to this bank are unavailable right now", before any money moves.

## 4. Fee — dynamic, paid by the person withdrawing, no fee table
Korapay has no fee quote; it reports the real fee in the disburse response, the
query and the webhook.
- **Shown:** "Transfer fee set by our payout partner, charged at cost", plus
  "usually about ₦X" once we have history — X = the highest fee recorded for this
  provider recently (our own `bank_withdrawals.fee`, self-updating).
- **Held:** `amount + that recent highest fee` (just `amount` with no history).
- **Real fee known** → charge exactly it, release any unused reserve at once.
- **Real fee > reserve** (rare) → take the difference from the available balance;
  any shortfall Doviz absorbs into a `provider_fees` expense account + alert.
  The user never pays more than the real fee; every kobo is in the ledger.
- A provider that **can** quote (e.g. Flutterwave) quotes exactly instead.

## 5. Flow — `POST /wallet/withdrawals`
`{ bankAccountId, amount, idempotencyKey, pin }`
1. PIN · own, active, name-matched bank account · limits (₦100–₦5,000,000)
2. Active provider + bank mapping · float check if the provider reports a balance
3. **Hold** (one transaction with inserting the withdrawal; ledger refuses overdraft)
4. Send to the provider — wait ≤ 8s, else answer `pending` and finish in the background
5. Webhook / follow-up checks (5s, 15s, 30s, 60s) / reconciler → **settle** (real fee,
   release reserve) or **refund in full**; unknown is never refunded on a guess
6. Socket: `withdrawal.updated` + `wallet.balance_changed` — the app never polls

Also `GET /wallet/withdrawals/:id`, statement lines "Withdrawal to GTBank ••6789" /
"Withdrawal refunded". The `bank_withdrawals` table and ledger types already exist
(migration adds `provider_settings`, fee-reserve fields, `provider_fees` account kind).

## 6. App
Send Money → pick a linked account (or add one) → amount (auto commas) → confirm
(account, amount, fee note, total held) → PIN → "Withdrawal sent" at once; the result
arrives by socket.

## 7. Tests
Real-Postgres money path (hold, settle with fee + reserve release, fee above reserve,
refund, timeout → verify, same-key retry, overdraft, provider swapped mid-flight),
Korapay mappers/webhook/signature, routes, app controller + render tests.
Sandbox: bank 033 / `0000000000` succeeds, 035 / `0000000000` fails.

## 8. Before live
Korapay live keys · payout IP whitelisting (`78.135.2.28` in dev) · webhook URL in the
dashboard (shared with deposits) · funded Korapay balance.
