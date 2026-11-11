# Ziks-to-Ziks transfers by tag: instant and free

Status: **API built** (tags, ledger lock order, limits, lookup, send, recent, statement, pushes). Decided: notes yes (100 chars), tags only (no phone), request money later, display name "Ada O.". App side next.

## 1. The product
A user sends naira from their balance to another Ziks user by their **tag**
(e.g. `@ada`).
- **Instant:** one database transaction moves the money between the two
  balances. No provider, no bank, no waiting, no webhooks.
- **Free:** no fee, ever. The ledger is ours, so it costs us nothing.
- **Final:** like a bank transfer, a completed transfer can't be reversed by
  the sender. Ops can reverse in exceptional cases (fraud) with a new
  posting, never by editing.

What's new vs. Send Money: Send Money pays out to **your own bank**;
this pays **another person's Ziks balance**.

## 2. Tags (`@handle`)
- Column `users.tag`, unique **case-insensitively** (stored lowercase).
  Shown as `@ada`.
- **Format:** `^[a-z][a-z0-9_]{2,19}$`. 3–20 characters, starting with a
  letter: letters, digits and underscores only.
- **Reserved:** a list of tags no one can take (`ziks`, `support`, `admin`,
  `help`, `official`, `team`, `security`, and similar), to stop impersonation.
- **Choosing one:** new users pick a tag during profile setup. Existing users
  get a one-time "Choose your tag" prompt on home, and can't receive by tag
  until they've set one. A live "is it available?" check shows suggestions
  built from the user's name (`adaokafor`, `ada_o`, `adaokafor2`).
- **Changing:** allowed once every 30 days. An old tag is **held for 30 days**
  (`user_tag_history`), so nobody can grab it and receive money meant for its
  previous owner.
- Audit log on every set or change.

## 3. Finding a recipient (no enumeration)
`GET /transfers/recipients?tag=ada`:
- **Exact match only:** no search, no listing, no partial matches.
- Returns `{ recipientId, tag, displayName: "Ada O.", initials }`. The first
  name and last initial are enough to recognise someone; we never return a
  phone number, email or full surname.
- **404** for no such tag, an inactive or suspended account, the user's own
  tag (they can't send to themselves), or a user without a completed profile.
- **Rate-limited** per user (e.g. 30 lookups per 10 minutes) so nobody can
  scrape the user base.
- **Recent recipients:** `GET /transfers/recipients/recent` lists the last 10
  people this user sent to, for one-tap repeat sends.

## 4. Sending
`POST /transfers` takes `recipientId` (from the lookup), `amount`, an
optional `note` (up to 100 characters), `idempotencyKey` and `pin`.

1. **PIN**, then **replay**: the same idempotency key returns the original
   transfer.
2. **Checks:**
   - the recipient is still active and isn't the sender;
   - the amount is within the per-transfer minimum and maximum;
   - the sender's **daily limit** (§6) isn't exceeded.
3. **One transaction:**
   - ledger posting `internal_transfer`: sender's `user_available` −amount,
     recipient's `user_available` +amount. The database refuses an overdraft,
     so an insufficient balance returns **402**;
   - insert an `internal_transfers` row with status `completed`;
   - audit both sides;
   - pushes, delivered only if the transaction commits:
     - `wallet.balance_changed` to **both** users;
     - `transfer.received` (`{ transferId, amount, senderTag }`) to the
       recipient.
4. Return the completed transfer. There's no pending state, so the app shows
   "Sent" straight away.

**Lock order:** the ledger currently updates balances in the order the
entries are listed. If A sends to B while B sends to A, the two transactions
lock the same two balances in opposite orders and can deadlock. Postgres
would cancel one, so no money is at risk, but it would fail a user's send.
`createLedgerPosting` will **apply entries in a fixed order (by account id)**.
That's a small, general fix that protects every posting.

## 5. Data
- `users.tag` (unique, lowercase) and `user_tag_history` (user_id, tag,
  released_at, held_until).
- **`internal_transfers`:** id, sender_id, recipient_id, amount, currency,
  note, idempotency_key (unique per sender), status (`completed`, later
  `reversed`), ledger_transaction_id, created_at. A trigger makes amounts and
  the two parties immutable, and rows can't be deleted, the same as the
  other money tables.
- **Ledger:** new transaction type `internal_transfer` (and later
  `internal_transfer_reversal`). No new account kinds, because it's user to
  user.
- **Statement labels:** "Sent to @ada" (debit) and "Received from @tunde"
  (credit). The detail view shows the note, the other party's display name
  and the reference.

## 6. Safety and limits (provider-agnostic, all in our database)
- **PIN on every send.** A confirm sheet first shows the recipient's
  display name and tag, the amount and "Free".
- **Limits are configurable, in the database** (decided 2026-11-11). They're
  not in code, so changing them needs no deploy. Table `transfer_limits`
  (scope, currency, min_amount, max_per_transfer, max_per_day, updated_by,
  updated_at), with one row for now: `scope = 'default'`.

  | Limit | Starting value |
  |---|---|
  | Minimum per transfer | ₦100 |
  | Maximum per transfer | ₦1,000,000 |
  | **Daily sending cap** | **₦1,000,000** (rolling 24 hours, sum of completed sends) |

  - Change with `npm run transfers:set-limits -- --daily 1000000
    [--max 1000000] [--min 100]`. Audited, and each change applies to the
    very next transfer.
  - The quote and the app read the current limits from
    `GET /transfers/limits`, along with **how much is left today**, so the
    amount screen can say "You can send up to ₦640,000 more today".
  - The daily check runs **inside** the send transaction, with the
    sender's balance row locked, so two sends at once can't both slip under
    the cap.
  - `scope` leaves room for per-user overrides or KYC tiers later (CBN Tier 1
    wallets are capped at ₦50,000 a day) without a schema change.
- **Frozen accounts** (status not active) can't send or receive.
- **Velocity alert:** many sends to new recipients in a short window raises
  an ops alert (a takeover pattern). It never blocks automatically in v1.
- **No negative balances:** the ledger constraint already guarantees it.

## 7. App (mobile)
- **Send Money** gets two choices:
  - **"To a Ziks user (free, instant)"**, the new flow;
  - **"To my bank account"**, the existing withdrawal flow.
- **To a Ziks user:**
  1. Enter `@tag`. A debounced lookup shows the person's initials and
     display name ("Ada O. · @ada") or "No Ziks user with that tag". Recent
     recipients appear as chips.
  2. Amount (with `NairaInputFormatter`) and an optional note.
  3. Confirm sheet ("Send ₦5,000 to Ada O. (@ada) · Fee: Free") → PIN.
  4. Success: "₦5,000 sent to Ada O." straight away.
- **Receiving:** a snackbar ("₦5,000 from @tunde") from `transfer.received`.
  Balance and history refresh by push.
- **"My tag" card** in Profile and Receive: `@ada` with copy and share, and a
  **QR code** (`qr_flutter` is already in the app) encoding `ziks://pay/ada`.
  Scanning it fills the recipient (the app already has `mobile_scanner`).
- **Tag setup:** a screen in onboarding, plus the one-time home prompt for
  existing users.

## 8. Tests
- **Real Postgres:**
  - a transfer moves exactly the amount, and both balances and the ledger
    balance out;
  - insufficient balance → 402, nothing moves;
  - sending to yourself or to an inactive user is refused;
  - an idempotent replay sends only once;
  - the daily limit is enforced across several transfers, and two sends at
    the same moment can't both slip under it;
  - a limit changed in the database applies to the very next transfer;
  - **A→B and B→A at the same moment both succeed** (no deadlock);
  - a tag held after a change can't be taken by someone else.
- **Unit:** tag format and reserved words, display-name masking, lookup rate
  limit, the 30-day tag change rule.
- **Mobile:** lookup debounce, the confirm sheet, idempotent retry, receiving
  by push.

## 9. Order of work
1. Tags: schema, set/change/check endpoints, the app's tag setup and prompt.
2. The ledger lock-order fix, plus its concurrency test.
3. Transfers: limits table, limits endpoint and `transfers:set-limits`;
   lookup, send, recent recipients, statement labels, pushes.
4. App: Send Money choice, the to-user flow, receiving, the My Tag card and QR.

## 10. Open questions
1. ~~Limits~~ **Decided:** ₦1,000,000 a day, configurable in the database
   (§6). Minimum ₦100, ₦1,000,000 per transfer.
2. **Notes:** allow a short note ("for lunch")? (Suggestion: yes, 100
   characters, shown to both.)
3. **Also find people by phone number?** It's convenient, but it reveals
   whether a number uses Ziks. (Suggestion: tags only for v1.)
4. **Request money** ("@tunde requests ₦5,000"): v2?
5. **Display name:** "Ada O." (first name + last initial), or full name?
   Banks show the full name for confirmation. (Suggestion: "Ada O.".)
