# Buy crypto with naira: provider-agnostic, KuCoin first

Status: **planned, not built**. Blocked on the KuCoin setup checks in §9; resume 2026-11-12.

## 1. The product
A user spends naira from their Doviz balance to have crypto sent to **their own
wallet address**. We never hold private keys: the coin comes from our KuCoin
funding balance, which we top up by hand. Selling crypto for naira already works
through Breet and is unchanged.

First release: **USDT on TRC20 and BSC** (cheapest fees, most demand). More coins
and networks are added as data, not code.

## 2. Why KuCoin (decisions so far)
- **Breet** can send crypto, but only from a USD balance funded by naira. It
  quotes no NGN→USD rate (`fiat-to-usd` returns `data: {}`), so we couldn't price
  safely. It stays our crypto→naira provider.
- **Self-custody** is ruled out: holding keys needs an SEC licence.
- **KuCoin**: we buy USDT ourselves, keep it in the KuCoin main (funding)
  account, set our own naira price, and KuCoin sends it. Our risk is limited to
  our pricing (§4) and the KuCoin account itself (a freeze stops sales; the
  money stays safe).
- **Regulatory**: confirm with a lawyer before launch whether selling crypto to
  Nigerian users this way needs our own SEC registration.

## 3. Provider-agnostic sending
`CryptoPayoutProvider` in `src/services/cryptoPayouts/`, implementations in
`providers/<name>/`, active provider in `provider_settings`
(`service = 'crypto_payouts'`). Same pattern as payouts: each purchase stores
its provider, and a switch only affects new purchases.

| Method | KuCoin |
|---|---|
| `listNetworks({ asset })` (fee, min, precision, enabled, memo needed) | `GET /api/v3/currencies/{currency}` (public; `chains[]`) |
| `getQuota({ asset, network })` | `GET /api/v1/withdrawals/quotas?currency=&chain=` (`withdrawMinFee`, `withdrawMinSize`, `precision`, `isWithdrawEnabled`, `remainAmount`) |
| `getBalance({ asset })` | `GET /api/v1/accounts?type=main&currency=` (`available`) |
| `send({ externalId, asset, network, address, memo, amount })` | `POST /api/v3/withdrawals` (`withdrawType: "ADDRESS"`, `chain` e.g. `trx`/`bsc`, `isInner: false`, `remark` = our id) → `data.withdrawalId` |
| `getSend({ providerReference })` | `GET /api/v1/withdrawals/{withdrawalId}` (`status`, `fee`, `walletTxId`, `failureReason`) |
| webhooks | **none**: KuCoin has no withdrawal webhook or websocket channel. Our server checks the status; the app still gets socket pushes. |

**Auth:** headers `KC-API-KEY`, `KC-API-SIGN`, `KC-API-TIMESTAMP` (ms),
`KC-API-PASSPHRASE`, `KC-API-KEY-VERSION`.
- **Sign:** Base64(HMAC-SHA256(secret, timestamp + METHOD + path?query + body)).
  The JSON body is compact and the URL is not URL-encoded.
- **Passphrase:** Base64(HMAC-SHA256(secret, passphrase)).

**Env:** `KUCOIN_API_KEY`, `KUCOIN_API_SECRET`, `KUCOIN_API_PASSPHRASE`.

**Rate limits:** withdraw weight 5; quotas and status weight 20, from the
"Management" pool. Cache network info (5 min) and don't check statuses too often.

**Duplicates:** KuCoin has no idempotency key on withdraw. Before re-sending, look
up our purchase's `providerReference`. If a send's outcome is unknown (timeout),
never re-send; mark it `needs_review` and match it by `remark`/amount in the
withdrawal history.

## 4. Pricing: our rate, never a loss
- `crypto_buy_rates` (asset, ngn_per_unit, set_by, set_at, expires_at), changed by
  script (`npm run crypto:set-rate -- USDT 1650`) with an audit log.
- **Expiry:** a rate older than `expires_at` (default 24 h) pauses buying for that
  coin ("unavailable right now"). A stale rate is the main way to lose money.
- **Non-USDT coins** (later): price = KuCoin live price in USDT × our USDT naira
  rate. Only the USDT rate is set by hand.
- **Optional markup** per asset (percentage), applied on top. Hidden like the bill
  commission: the user sees one naira price.
- **Sanity guard:** refuse to set a rate more than X% from the last one without
  `--force`, to catch typos.

## 5. Quote → confirm → send
`GET /crypto/buy/quote?asset=USDT&network=trx&ngnAmount=50000` (or `cryptoAmount`) returns:
- the crypto the user receives;
- the network fee (from quotas/currency, converted to naira at our rate);
- the naira total;
- the rate's expiry;
- min/max: KuCoin `withdrawMinSize`, our own limits, and the provider's balance.

`POST /crypto/buy` (`asset`, `network`, `address`, `memo?`, `ngnAmount`,
`expectedTotal`, `idempotencyKey`, `pin`):
1. **PIN**, then replay by idempotency key.
2. **Re-quote** with the current rate. If the total isn't `expectedTotal`, return
   409 `QUOTE_CHANGED` and hold nothing. The app re-confirms, as with Send Money.
3. **Validate the address** per network (TRC20 `T…` base58check, BSC `0x` + 40 hex)
   and require a memo where `needTag` is set.
4. **Check KuCoin**: the network is enabled and `getBalance` is at least the
   amount plus the fee. If not, return 503, nothing held, and alert ops (low balance).
5. **One transaction**:
   - ledger hold `user_available → crypto_purchases_in_transit`;
   - insert `crypto_purchases` (provider, environment, asset, network, address,
     amounts, rate used, fee, status `pending`);
   - audit log;
   - `wallet.balance_changed`.
6. **Send** (bounded wait), then follow-up checks [5 s, 15 s, 30 s, 60 s, 2 min, 5 min],
   then a reconciler job (every 2 min) until final.
7. **Completed:** ledger `crypto_purchases_in_transit → crypto_sales_revenue`
   (the naira we earned for coin that left KuCoin). Store `walletTxId` so the app
   can link to the block explorer. Push `crypto_purchase.updated`.
8. **Failed** (KuCoin `FAILURE`, or rejected on send): refund the full hold and
   push the update.
9. **Unknown** (timeout with no `withdrawalId`): `needs_review`, never refunded
   automatically, because the coin might have gone. Ops resolve it from KuCoin
   history.

Fee: as with bills, the network fee is part of the naira price, so the user
receives exactly the crypto amount quoted.

## 6. Accounting
- Ledger only tracks naira, as today. KuCoin's USDT stock is tracked outside the
  ledger: `crypto_inventory_movements` (top-ups, with naira cost, and sends).
- That gives the average cost per USDT and a report of margin per sale
  (sale naira − cost naira).
- **Low-balance alert** when KuCoin `available` falls below a threshold (env), and
  a daily check of the balance against our records.

## 7. App (mobile)
- Home "Swap Crypto" becomes **Buy / Sell** (a toggle on the swap screen). Sell is
  unchanged.
- **Buy screen:**
  - pick a coin and network, with each network's fee and a warning to use the
    same network;
  - paste or scan an address;
  - enter an amount in naira or in crypto;
  - quote → confirm sheet (they receive X USDT on TRC20 at address …, total ₦Y) → PIN;
  - same idempotency and 409 re-quote handling as Send Money.
- **Status screen:** "Sending…", updated by `crypto_purchase.updated`; once done,
  the transaction hash with an explorer link; on failure, "your naira is back".
- Saved addresses can come later.

## 8. Tests
- **KuCoin client:** signing matches KuCoin's documented example; mapping each
  status; `260325` (address not on the whitelist) → configuration error, not a
  user error.
- **Real-Postgres money paths:**
  - hold, then send, then complete;
  - KuCoin rejects the send → refund;
  - timeout with no ID → `needs_review`, no refund;
  - expired rate → refused before anything is held;
  - 409 when the price changed;
  - not enough on KuCoin → 503, nothing held;
  - same idempotency key → the original purchase;
  - address validation per network.

## 9. Before building: user checks (2026-11-11)
1. **The address whitelist must be off** on the KuCoin API account. If KuCoin's
   "favorite addresses" setting is on, sends to new addresses fail (`260325`).
   If KuCoin forces it on for API withdrawals, **KuCoin cannot be used**.
2. **Classic or Unified Trading Account?** Classic uses `POST /api/v3/withdrawals`;
   unified uses `POST /api/ua/v2/asset/withdrawal`.
3. Create an API key with **General + Withdrawal** permissions, whitelisted to IP **78.135.2.28**.
   Put the key, secret and passphrase in `.env`.
4. Put USDT in the **main (funding)** account.
5. Lawyer: is our own SEC registration needed?

## 10. Answered by the first real test ($1 USDT, with approval)
KuCoin has no sandbox (none found), so these are checked with a real ~$1 send:
- Is the fee taken from `amount` or charged on top from the balance? This decides
  how we quote.
- Withdrawal `status` values other than `SUCCESS`, and when `walletTxId` appears.
- Whether `withdrawMinFee` (quotas) and the per-chain `withdrawalMinFee`
  (currency) disagree, and which applies.
