# Buy crypto (crypto sends)

Users spend naira from their Ziks balance and receive crypto at **their own
wallet address**. We never hold private keys: a provider sends the coin from a
balance we top up by hand. KuCoin is the first provider; any provider that can
"send coin X on network Y to an address" can be added behind the same interface.

Design and decisions: [NAIRA_TO_CRYPTO_PLAN.md](../../../NAIRA_TO_CRYPTO_PLAN.md).
Selling crypto for naira (Breet) is a separate feature and is unaffected.

## How a purchase works

1. The app shows `GET /crypto/buy/quote`: the coin received, the network fee,
   and the naira total. The network fee is priced in, so the user receives
   exactly the quoted amount.
2. `POST /crypto/buy` with the PIN, the quote's total as `expectedTotal` and
   its coin amount as `expectedCryptoAmount`. The server re-prices with the
   **active** provider and the current price, and goes ahead if the user pays
   no more than `expectedTotal` and gets no more than **0.5% less** coin
   (`RECEIVE_TOLERANCE_PERCENT`). Otherwise it returns **409** and nothing is
   taken. Without `expectedCryptoAmount` (older apps) the total must match
   exactly.
3. The address is checked for its network (see below). Stock of that coin at
   the provider is checked where the provider can report it.
4. One database transaction: hold the naira (`user_available →
   crypto_sends_in_transit`), record the purchase with its provider and price,
   write the audit log, push `wallet.balance_changed`.
5. Send to the provider (we wait up to 8 s), then follow-up checks at
   5 s / 15 s / 30 s / 1 min / 2 min / 5 min, then the
   `reconcile-crypto-purchases` job every 2 min.
6. The outcome:
   - **Completed:** settle to `crypto_sales`, store the tx hash, record the
     coin that left our stock, and push `crypto_purchase.updated`.
   - **Failed:** the provider refused, or its own record says failed. Refund
     the full total and push the update.
   - **Unknown for over 30 min:** `needs_review`. **It is never refunded
     automatically**, because the coin may have left and crypto can't be
     pulled back. The reconciler keeps checking. Ops resolve it with
     `crypto-purchases:resolve`.

Statuses: `pending`, `processing`, `needs_review`, `completed`, `failed`.

## What can be bought

| Coin | Networks (our names) |
|---|---|
| USDT | TRC20, BEP20, ERC20, POLYGON, ARBITRUM, OPTIMISM, AVAXC, SOLANA, TON (memo supported, optional: KuCoin's `needTag`; Bybit and personal wallets need none) |
| USDC | ERC20, POLYGON, ARBITRUM, OPTIMISM, BASE, AVAXC, SOLANA |
| ETH | ETHEREUM (mainnet; the row selling uses), BEP20, ARBITRUM, OPTIMISM, BASE |

Each network has an address check in `src/utils/cryptoPurchases/isValidCryptoAddress/`:
TRON base58check; EVM `0x` + 40 hex (format only, no Keccak in Node); Solana
base58 → exactly 32 bytes; TON raw `0:<hex>` or user-friendly with its CRC16
(testnet addresses refused). A network without a check can't be bought.

Not offered (no address check we trust, deprecated, or easy to confuse with a
mainstream chain): KCC, NEAR, Aptos, Sui, Polkadot Asset Hub, Tezos, Conflux,
Kava EVM, Plasma, Stable, Sonic, Monad, Arc, XDC, Robinhood; and chains with
KuCoin withdrawals off (TON "ton2", Movement, HBAR). To add one: an address
check, a line in `PROVIDER_NETWORK_ALIASES`, and the coin in `BUYABLE_ASSETS`.

## How a coin is priced

`fetchCryptoBuyPrice`, in this order:

1. **A rate we set for the coin**, while in force (`crypto:set-rate`). USDT
   always works this way; any other coin can be pinned the same way.
2. **Otherwise from the market:** our USDT naira rate × the provider's live
   price of the coin in USDT (`getUsdtPrice`; KuCoin: best ask on the public
   `ETH-USDT` order book), with markup = the USDT rate's markup + the coin's
   (`crypto_buy_markups`, set with `crypto:set-buy-markup`; seeded USDC 0%,
   ETH 1.5%; a coin without a row gets 1.5%).

A live price is cached for 15 s. It's refused (the coin shows as unavailable)
when it's missing, not positive, or more than 10% away from the price used
under a minute ago (a bad tick). No USDT rate in force means no market-priced
coin either: we never price on a stale number.

Each purchase stores how it was priced, immutably: `price_source` (`rate` /
`market`), `rate_id` (the coin's rate, or the USDT one), `market_price_usdt`
and `markup_percent`.

## Code layout

| Where | What |
|---|---|
| `cryptoSendProvider.ts` | The interface. `listSendableAssets`, `send` and `getSend` are required; `getSendTerms` and `getBalance` are optional, and callers skip those steps safely when a provider lacks them. |
| `types.ts`, `cryptoSendProviderError.ts` | Neutral shapes and errors. `rejected` / `configuration` mean nothing was sent, so a refund is safe. `unavailable` / `invalid_response` mean the outcome is unknown: verify first. |
| `cryptoSendProviderRegistry.ts`, `providers/index.ts` | Registration at startup. KuCoin registers only when `KUCOIN_API_KEY` is set; `fakesend` registers outside production only. |
| `providers/kucoin/` | KuCoin adapter. Its chain ids, statuses, error codes and request signing never leave this folder. |
| `providers/fake/` | `fakesend`: a pretend sender for local and e2e testing (KuCoin has no sandbox). A send completes on its first status check. |
| `src/actions/cryptoBuy*`, `src/actions/cryptoPurchase*` | Quote, create, sync, settle, refund, fetch. |
| `src/utils/cryptoPurchases/` | Pricing, address checks, the API view, failure → HTTP mapping. |
| `src/jobs/reconcileCryptoPurchases.ts` | The reconciler (lock key 7301006). |
| `scripts/crypto-buy/buyableAssets.ts` | The coins we sell, and each provider's network ids → ours (`trx` → `TRC20`). |

The provider for **new** purchases is chosen in `provider_settings`
(`service = 'crypto_sends'`). Each purchase stores its own provider, so
switching while purchases are in flight is safe: they finish on their own
provider.

## Database

| Table / change | Purpose |
|---|---|
| `crypto_purchases` | One row per purchase. A trigger makes amounts, address, price, provider and ledger links immutable, and stops a final status from changing. Rows can't be deleted. |
| `crypto_buy_rates` | Our naira price per coin symbol, with an optional markup and an expiry. Append-only: a change is a new row, and purchases keep the row they were priced with. |
| `crypto_buy_markups` | Our markup per market-priced coin (USDC, ETH…). |
| `crypto_purchases` pricing columns | `price_source`, `market_price_usdt`, `markup_percent` (migration `20261112090000_add_crypto_buy_market_pricing`). |
| `crypto_stock_movements` | Coin at the provider, outside the naira ledger: top-ups (with their naira cost) and sends. Used for average cost, margin and checking against the provider's balance. Append-only. |
| `crypto_assets.is_buy_enabled` | Whether a coin can be bought. Separate from `is_enabled`, which is selling. |
| `crypto_provider_assets` send columns | `can_send`, `min_send`, `send_fee`, `send_precision`, `memo_required`, filled by the sync. |
| Ledger | Accounts `crypto_sends_in_transit` (per provider) and `crypto_sales`. Transaction types `crypto_purchase_hold`, `crypto_purchase_settle`, `crypto_purchase_reversal`. |

Migration: `migrations/queries/20261111061305_add_crypto_purchases.*.sql`.

## API (app)

All endpoints need auth and are documented in Scalar under **Buy crypto**.

| Endpoint | |
|---|---|
| `GET /crypto/buy/assets` | Buyable coins and networks, with fee, minimum, `maxAmount`/`maxTotal` (what our stock can deliver) and current unit price. Only coins we hold enough of to cover a network's minimum + fee are listed (provider balance, cached 20 s; a failed lookup hides the coin). `isAvailable: false` while no rate is in force. |
| `GET /crypto/buy/quote?assetId=&cryptoAmount=` or `&nairaTotal=` | Price a purchase. Send exactly one of the two amounts. |
| `POST /crypto/buy` | Buy. Body: `assetId`, `cryptoAmount` or `nairaTotal`, `address`, `memo?`, `expectedTotal`, `expectedCryptoAmount` (recommended), `idempotencyKey` (UUID, reused on retry), `pin`. |
| `GET /crypto/buy/:purchaseId` | One purchase. Fetch it when `crypto_purchase.updated` names it, or after the socket reconnects. |

Errors:

| Code | Meaning |
|---|---|
| 400 | Invalid input, address or amount, or the coin isn't buyable right now. |
| 402 | The balance doesn't cover the total. |
| 400 (quote) | Over what our stock can deliver: "You can buy up to ₦X (Y USDT) right now." |
| 409 | The price moved against the user (more naira, or over 0.5% less coin). Re-quote and confirm again. |
| 503 | Buying is paused (no provider, sold out / balance lookup failed, or no current rate). Nothing was taken. |

## Ops commands

| Command | What it does |
|---|---|
| `npm run crypto-sends:sync [-- <provider>] [--enable]` | **Run once per new coin/network**, not to refresh fees: fees, minimums and on/off are read live from the provider (cached 60 s; the stored values are only a fallback when it can't be reached). Maps a provider's coins/networks onto ours and stores fee, minimum, precision and memo. Defaults to the active provider. New coins start buy-enabled. `--enable` also switches buying on for coins that already existed (e.g. USDT/TRC20 from selling). A coin someone switched off stays off without it. |
| `npm run crypto-sends:use -- <provider>` | Makes a provider active for new purchases. Refuses one with no synced coins. Audited. |
| `npm run crypto:set-rate -- USDT 1650 [--markup 1.5] [--hours 24] [--note "…"] [--force]` | Sets our naira price per coin. It expires after `--hours` (default 24, max 168), and **buying that coin pauses once it expires**. Refuses a change of more than 5% from the last rate unless you add `--force` (to catch typos). Audited. |
| `npm run crypto:set-buy-markup -- ETH 2 [--note "…"]` | Our markup on a market-priced coin (0–20%). Audited; the next quote uses it. Not for USDT (set its rate's `--markup`). |
| `npm run crypto:record-topup -- <provider> <SYMBOL> <quantity> <naira cost> [--note "…"]` | Records coin you bought into the provider balance and what it cost, e.g. `kucoin USDT 500 825000`. Audited. |
| `npm run crypto-purchases:resolve -- <purchaseId> sent\|refund [--tx <hash>]` | Resolves a `needs_review` purchase **after checking the provider's own history**. `sent` settles it; `refund` returns the naira. Only works on `needs_review`. Audited as an admin action. |

## Running it locally (no KuCoin keys)

```sh
npm run crypto-sends:sync -- fakesend --enable
npm run crypto-sends:use -- fakesend
npm run crypto:set-rate -- USDT 1650
```

Purchases then complete about 5 s after they're made. Nothing leaves the
machine. `FAKE_CRYPTO_STOCK` (default 100000) sets the fake balance.

## Going live with KuCoin

1. **On the KuCoin account:**
   - create an API key with **General + Withdrawal** permissions, restricted
     to the server IP;
   - make sure the **withdrawal address whitelist is off**, otherwise sends
     to user addresses fail with `260325`;
   - note whether the account is Classic or Unified.
2. **`.env`:** `KUCOIN_API_KEY`, `KUCOIN_API_SECRET`, `KUCOIN_API_PASSPHRASE`,
   and optionally `KUCOIN_API_KEY_VERSION` (default `2`) and
   `KUCOIN_ACCOUNT_MODE` (`classic` default, or `unified`).
3. **Fund** the KuCoin **main (funding)** account with USDT, then record it
   with `crypto:record-topup`.
4. **Point the server at KuCoin:**
   ```sh
   npm run crypto-sends:sync -- kucoin --enable
   npm run crypto-sends:use -- kucoin
   npm run crypto:set-rate -- USDT <rate>
   ```
   USDC and ETH need no rate: they follow the USDT rate and KuCoin's market
   price. Fund each coin you sell in the KuCoin main account (the stock check
   is per coin) and record it with `crypto:record-topup`.
5. **Make one real ~$1 send and check what KuCoin really does.** These are
   assumed in the adapter (marked in `providers/kucoin/`):
   - whether the fee comes out of the amount or on top
     (`FEE_INCLUDED_IN_AMOUNT`);
   - status names other than `SUCCESS`;
   - most error codes;
   - the withdrawal-history shape used to find a send whose response was lost.

## Adding a provider

1. Create `providers/<name>/` implementing `CryptoSendProvider`. Map its
   statuses to `PROVIDER_SEND_STATUS` and its errors to `CryptoSendProviderError`
   codes. Put our purchase id somewhere it can be searched (`getSend` without
   a provider reference must work).
2. Register it in `providers/index.ts` (only when its credentials are set).
3. Add its network ids to `PROVIDER_NETWORK_ALIASES` in
   `scripts/crypto-buy/buyableAssets.ts`.
4. Run `crypto-sends:sync -- <name>`, then `crypto-sends:use -- <name>`.

## Tests

- **Unit:** `npx jest tests/cryptoSends tests/cryptoPurchases`. Covers the
  KuCoin adapter (mocked HTTP), pricing and address checks.
- **Real Postgres:** run against a **disposable**, fully migrated database
  (money rows can't be deleted). Covers the money paths: settle, refund,
  review, the guards, idempotency and switching providers mid-flight.
  ```sh
  DB_INTEGRATION=true DB_PORT=<port> npx jest tests/cryptoPurchases --runInBand
  ```
  `--runInBand`: the files switch the active provider in the shared
  `provider_settings` row, so they must not run at the same time.
