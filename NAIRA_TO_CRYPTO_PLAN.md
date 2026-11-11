# Buy crypto with naira: provider-agnostic, KuCoin first

Status: **server built (2026-11-11)**. This covers:
- the provider layer, the KuCoin adapter and a fake sender;
- the catalog sync, rates, quote, buy, follow-up checks, the reconciler and refund/review;
- endpoints, docs and ops scripts;
- tests: 16 on real Postgres plus unit tests.

Dev runs on the `fakesend` provider. Next: the mobile Buy screen. KuCoin goes live after the §10 checks and a first ~$1 test send (§11).

## 1. The product
A user spends naira from their Doviz balance and receives crypto at **their own
wallet address**. We never hold private keys: a provider (KuCoin first) sends
the coin from a balance we top up by hand. Selling crypto for naira (Breet) is
unchanged.

First release: **USDT on TRON (TRC20) and BSC (BEP20)**. More coins and networks
are added as data: a catalog sync plus enabling rows. No code changes.

## 2. Decisions so far
- **Breet** can send crypto, but only from a Breet USD balance. Its NGN→USD
  conversion quotes no rate, so we couldn't price safely. Breet stays our sell
  (crypto→naira) provider.
- **Self-custody** is ruled out: holding keys needs an SEC licence.
- **KuCoin first.** We buy the stock (USDT) ourselves, set our own naira rate,
  and KuCoin sends it.
- **Any provider that can "send coin X on network Y to an address" can replace
  it**, e.g. Quidax, Busha or Yellow Card. That's one new folder.
- **Regulatory:** confirm with a lawyer whether selling crypto to Nigerian users
  this way needs our own SEC registration.

## 3. Agnostic rules (same as bills and payouts)
1. **Our vocabulary everywhere outside `providers/<name>/`.** We use our own
   asset (symbol + network, from `crypto_assets`), amounts as decimal strings,
   our statuses, and our error codes. A provider's chain ids (`trx`, `bsc`),
   status strings, error codes and fee quirks never leave its folder.
2. **Providers return raw facts. Our code makes the decisions:** pricing,
   limits, refund vs. review. A provider never decides to refund.
3. **Optional capabilities**, as with `PayoutProvider.getBalance`. If a provider
   can't do something, we skip that step safely and never fail:
   - no balance API → the stock check is skipped (we rely on the send failing
     cleanly);
   - no webhooks → status checks only;
   - no fee API → the fee comes from the synced catalog.
4. **DB-chosen active provider:** `provider_settings` row `service = 'crypto_sends'`,
   switched by `npm run crypto-sends:use -- <provider>` (audited; refuses an
   unconfigured provider or one without synced assets).
5. **A switch mid-flight is safe:** each purchase stores its provider and
   environment, and every later step uses **the row's provider**, never the
   active one.

## 4. The interface: `src/services/cryptoSends/`
```ts
interface CryptoSendProvider {
  readonly name: string;
  readonly environment: ProviderEnvironment;

  /** Coins/networks it can send: fee, minimum, precision, memo needed, enabled. */
  listSendableAssets(): Promise<ProviderSendableAsset[]>;
  /** Live fee/min/enabled for one asset (the catalog can go stale). Optional. */
  getSendTerms?(args: { providerAssetId: string }): Promise<ProviderSendTerms>;
  /** Our stock available to send. Optional: null/absent → stock check skipped. */
  getBalance?(args: { providerAssetId: string }): Promise<string | null>;

  send(args: { externalId: string; providerAssetId: string; address: string; memo: string | null; amount: string }): Promise<ProviderSend>;
  /** Look up by its reference, or by ours when a send response was lost. Null = not found. */
  getSend(args: { providerReference: string | null; externalId: string }): Promise<ProviderSend | null>;

  /** Optional: only providers that push results. */
  verifyWebhook?(request: WebhookRequest): boolean;
  parseWebhook?(body: unknown): ProviderWebhookEvent | null;
}
```
- `ProviderSend` = { providerReference, status (`PROVIDER_SEND_STATUS`: pending |
  completed | failed), amountSent, feeCharged, txHash, failureReason, raw }.
- Errors use `CryptoSendProviderError` with our codes, mirroring payouts:
  - `rejected` and `configuration`: nothing was sent, so a refund is safe;
  - `unavailable` and `invalid_response`: the outcome is unknown, so verify
    before deciding.
- Registry and `registerCryptoSendProviders()` are wired in `app.ts`, like payouts.
- **A fake provider ships with it** (`providers/fake/`, sandbox only, for dev).
  KuCoin has no sandbox, so local and e2e testing use the fake.
  `npm run crypto-sends:use -- fake`.

## 5. Catalog: reuse what the sell side already has
- **`crypto_assets`** (symbol + network, neutral) is reused as is. Add
  `is_buy_enabled` (default false), separate from the existing selling flag.
- **`crypto_provider_assets`** maps each asset to a provider. KuCoin rows:
  - `provider_code` = currency (`USDT`);
  - `provider_asset_id` = `USDT:trx` (the provider's own key, opaque to us).
- Add nullable buy-side columns, filled by the sync:
  - `min_send`, `send_fee`, `send_precision`;
  - `memo_required`, `is_send_enabled`.
  Breet's rows leave them null.
- **Matching** a provider's network to ours is data-driven: a `network_aliases`
  list per provider in the sync script (`trx` → `tron`, `bsc` → `bsc`), never in
  shared code.
- **Sync:** `npm run crypto-sends:sync` calls `listSendableAssets()` for the active
  provider and upserts the mappings. An unmatched network is logged, never guessed.

## 6. Pricing: ours, provider-independent, never a loss
- **`crypto_buy_rates`**: append-only, like `conversion_markups`. Columns:
  `asset_symbol`, `ngn_per_unit`, `markup_percent`, `effective_from`,
  `expires_at`, `set_by`, `note`.
  The rate is per **symbol** (USDT), not per network.
- Set by `npm run crypto:set-rate -- USDT 1650 [--markup 1.5] [--hours 24]`,
  with an audit log. The script refuses a change of more than X% from the last
  rate without `--force` (to catch typos).
- **Expiry:** no rate in force (expired or never set) → that coin's buying is
  unavailable. A stale rate is the main way to lose money.
- **Network fee:** the provider fee (`send_fee` in the coin, or live from
  `getSendTerms`) is converted at the same rate and added. The user gets exactly
  the quoted amount; the total covers the fee.
- **Markup** is hidden, like the bill commission: the user sees one price.
- **Later, non-USDT coins:** the rate is derived from a price feed × the USDT
  rate. That's a pluggable `PriceSource`, not part of the send provider.

## 7. Flow
`GET /crypto/buy/assets` returns enabled coins and networks (fee, minimum, memo needed).

`GET /crypto/buy/quote?assetId=&ngnAmount=` (or `cryptoAmount`) returns:
- the crypto received;
- the network fee in the coin and in naira;
- the naira total;
- the rate expiry;
- limits: provider minimum, our min/max, and the provider's stock where known.

`POST /crypto/buy` (`assetId`, `address`, `memo?`, `amount`, `expectedTotal`,
`idempotencyKey`, `pin`):
1. **PIN**, then replay by idempotency key.
2. **Quote again with the active provider and current rate.** If the total isn't
   `expectedTotal`, return 409 `QUOTE_CHANGED` and hold nothing.
3. **Validate the address in our code**, per network (TRON base58check `T…`;
   EVM `0x` + 40 hex, checksum if mixed case). Require a memo when
   `memo_required` is set.
4. **Check stock** with `getBalance` (skipped if the provider can't report it).
   If short, return 503 with nothing held, and alert ops.
5. **One transaction:**
   - ledger hold `user_available → crypto_sends_in_transit`;
   - insert `crypto_purchases` with: provider, environment, asset, address,
     memo, crypto amount, fee, naira total, rate row id, idempotency key, and
     status `pending`;
   - audit log;
   - `wallet.balance_changed`.
6. **Send**, waiting at most 8 s, then follow-up checks at [5 s, 15 s, 30 s,
   60 s, 2 min, 5 min], then the reconciler job (every 2 min) until final.
   Webhooks are used only if the provider has them.
7. **Completed:** settle `crypto_sends_in_transit → crypto_sales` (naira revenue).
   Store `txHash` and push `crypto_purchase.updated`.
8. **Failed**, or rejected/configuration on send: refund the full hold and push.
9. **Unknown** (timeout; `getSend` finds nothing; no provider reference):
   `needs_review`, **never auto-refunded**, because the coin may have left. Ops
   resolve it from the provider's history. This is stricter than naira payouts,
   because crypto sends can't be reversed.

## 8. Stock and accounting
- The ledger stays naira-only. Coin stock is tracked in `crypto_stock_movements`
  (provider, symbol, quantity ±, naira cost for top-ups, purchase id for sends).
  Top-ups are recorded by script: `npm run crypto:record-topup -- USDT 500 825000`.
- **Reports:** average cost per unit, margin per sale (sale naira − cost naira),
  and the difference between our stock records and the provider's balance.
- **Low-stock alert** below a threshold per symbol (env).

## 9. App (mobile)
- Swap gets a **Buy / Sell** toggle. Sell is unchanged.
- **Buy screen:**
  - coin, then network (fee shown, plus "send only on TRC20" warning);
  - address (paste or scan; checked on the device and again on the server);
  - memo when needed;
  - amount in naira or crypto;
  - quote → confirm sheet → PIN, with the same idempotency and 409 re-quote
    handling as Send Money.
- **Status screen:** "Sending…", updated by `crypto_purchase.updated`; once done,
  the hash with an explorer link; on failure, "your naira is back"; for review,
  "we're checking this, your money is safe".
- Saved addresses come later.

## 10. Before KuCoin goes live: user checks
1. **KuCoin's address whitelist must be off** for the API key. Otherwise sends to
   new addresses fail with `260325`. If KuCoin forces it on, use another provider
   (the design doesn't change).
2. **Classic or Unified account?** It decides KuCoin's withdraw endpoint. Only
   the KuCoin folder cares.
3. Create an API key with **General + Withdrawal** permissions, restricted to IP
   **78.135.2.28**. Add `KUCOIN_API_KEY`, `KUCOIN_API_SECRET` and
   `KUCOIN_API_PASSPHRASE` to `.env`.
4. Put USDT in the **main (funding)** account.
5. Lawyer: our own SEC registration?

## 11. KuCoin adapter notes (`providers/kucoin/` only)
| Interface | KuCoin |
|---|---|
| `listSendableAssets` | `GET /api/v3/currencies/{currency}` (public): `chains[]` gives `chainId`, `withdrawalMinSize`, `withdrawalMinFee`, `withdrawPrecision`, `needTag`, `isWithdrawEnabled` |
| `getSendTerms` | `GET /api/v1/withdrawals/quotas?currency=&chain=` (weight 20) |
| `getBalance` | `GET /api/v1/accounts?type=main&currency=`: `available` |
| `send` | `POST /api/v3/withdrawals` (Classic) or `POST /api/ua/v2/asset/withdrawal` (Unified). Body: `currency`, `chain`, `toAddress`, `memo`, `amount`, `withdrawType: "ADDRESS"`, `isInner: false`, `remark` = our id. Returns `data.withdrawalId`. |
| `getSend` | `GET /api/v1/withdrawals/{withdrawalId}`: `status`, `fee`, `walletTxId`, `failureReason`. If we have no id, search the withdrawal history for `remark` = our id. |
| auth | `KC-API-KEY`, `KC-API-SIGN` (Base64 HMAC-SHA256 of timestamp + METHOD + path?query + body), `KC-API-TIMESTAMP`, `KC-API-PASSPHRASE` (HMAC-signed), `KC-API-KEY-VERSION` |
| webhooks | none: no `verifyWebhook` / `parseWebhook` |
| error mapping | `260325` (not whitelisted) → `configuration`; insufficient balance → `rejected`; 5xx or timeout → `unavailable` |

**Duplicates:** KuCoin's withdraw has no idempotency key. Never re-send a
purchase that has a provider reference or an unknown outcome. Re-sending is
allowed only after `getSend` confirms nothing exists.

**Settled by the first real ~$1 send (each one only with approval):**
- is the fee taken from `amount` or on top?
- the status values besides `SUCCESS`;
- when `walletTxId` appears;
- whether the quotas fee and the per-chain fee disagree.

## 12. Tests
- **Contract tests** run against the fake and a mocked KuCoin HTTP layer:
  - status mapping;
  - error mapping;
  - optional capabilities missing → steps skipped;
  - KuCoin signing against its documented example.
- **Real-Postgres money paths** (fake provider):
  - complete;
  - rejected → refund;
  - timeout → `needs_review`, no refund;
  - expired or no rate → refused before any hold;
  - 409 when the price changed;
  - not enough stock → 503, nothing held;
  - idempotent replay;
  - provider switched mid-flight → the purchase finishes on its own provider;
  - address validation per network.
- **Catalog sync:** aliases map; an unknown network is skipped and logged.
