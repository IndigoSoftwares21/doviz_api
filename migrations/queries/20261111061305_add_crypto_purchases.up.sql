-- Buying crypto with naira (NAIRA_TO_CRYPTO_PLAN.md). Provider-agnostic; KuCoin
-- first. No table or column is named after a provider. We never hold keys: a
-- provider sends the coin from a balance we top up.

-- -----------------------------------------------------------------------------
-- Ledger: naira held for a purchase in flight (per provider), and the naira
-- earned once the coin has gone.
-- -----------------------------------------------------------------------------
ALTER TABLE ledger_accounts
    DROP CONSTRAINT ledger_accounts_kind_check,
    DROP CONSTRAINT ledger_accounts_provider_check,
    ADD CONSTRAINT ledger_accounts_kind_check CHECK (
        kind IN ('user_available', 'provider_clearing', 'payouts_in_transit', 'markup_revenue',
                 'bills_in_transit', 'bill_revenue', 'provider_fees',
                 'crypto_sends_in_transit', 'crypto_sales')
    ),
    ADD CONSTRAINT ledger_accounts_provider_check CHECK (
        (kind IN ('provider_clearing', 'payouts_in_transit', 'bills_in_transit', 'provider_fees',
                  'crypto_sends_in_transit')) = (provider IS NOT NULL)
    );

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal',
                 'bill_hold', 'bill_settle', 'bill_reversal', 'naira_deposit',
                 'crypto_purchase_hold', 'crypto_purchase_settle', 'crypto_purchase_reversal')
    );

-- -----------------------------------------------------------------------------
-- Which provider sends coins for NEW purchases.
-- -----------------------------------------------------------------------------
ALTER TABLE provider_settings
    DROP CONSTRAINT provider_settings_service_check,
    ADD CONSTRAINT provider_settings_service_check CHECK (service IN ('payouts', 'crypto_sends'));

INSERT INTO provider_settings (service, active_provider) VALUES ('crypto_sends', 'kucoin');

-- -----------------------------------------------------------------------------
-- Catalog: our coins (crypto_assets) gain a buy switch, separate from selling's
-- is_enabled. A provider's mapping gains what sending needs; sell-only
-- providers leave these null.
-- -----------------------------------------------------------------------------
ALTER TABLE crypto_assets
    ADD COLUMN is_buy_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE crypto_provider_assets
    ADD COLUMN can_send BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN min_send NUMERIC(38, 18),
    ADD COLUMN send_fee NUMERIC(38, 18),
    ADD COLUMN send_precision SMALLINT,
    ADD COLUMN memo_required BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT crypto_provider_assets_send_check CHECK (
        (min_send IS NULL OR min_send >= 0) AND (send_fee IS NULL OR send_fee >= 0)
        AND (send_precision IS NULL OR send_precision BETWEEN 0 AND 18)
    );

-- -----------------------------------------------------------------------------
-- Our naira price per coin symbol (USDT, not per network). Append-only: a change
-- is a new row; purchases keep the row they were priced with. Without a row in
-- force (expired / never set) that coin can't be bought.
-- -----------------------------------------------------------------------------
CREATE TABLE crypto_buy_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(16) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    rate NUMERIC(24, 8) NOT NULL,
    markup_percent NUMERIC(6, 3) NOT NULL DEFAULT 0,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    set_by VARCHAR(64) NOT NULL,
    note VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_buy_rates_rate_check CHECK (rate > 0),
    CONSTRAINT crypto_buy_rates_markup_check CHECK (markup_percent >= 0 AND markup_percent <= 20),
    CONSTRAINT crypto_buy_rates_expiry_check CHECK (expires_at > effective_from),
    CONSTRAINT crypto_buy_rates_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX crypto_buy_rates_current_idx ON crypto_buy_rates (symbol, currency, effective_from DESC);

CREATE TRIGGER crypto_buy_rates_append_only
    BEFORE UPDATE OR DELETE ON crypto_buy_rates
    FOR EACH ROW EXECUTE FUNCTION doviz_block_mutation();

-- -----------------------------------------------------------------------------
-- A purchase. total_naira (= naira_amount + naira_fee) is HELD (user →
-- crypto_sends_in_transit) in the same transaction as the insert.
--   pending      — held; sent (or about to be) to the provider
--   processing   — outcome unclear (timeout / unclear error); checks continue
--   needs_review — can't tell if the coin left; NEVER refunded automatically
--   completed    — provider confirmed; settled to crypto_sales
--   failed       — provider confirmed it wasn't sent; refunded in full
-- crypto_amount is what the user receives; network_fee the provider's fee
-- (in the coin) we priced in. `id` is sent to the provider as our reference.
-- -----------------------------------------------------------------------------
CREATE TABLE crypto_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    asset_id UUID NOT NULL REFERENCES crypto_assets (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    provider_asset_id VARCHAR(64) NOT NULL,
    provider_reference VARCHAR(128),
    idempotency_key VARCHAR(64) NOT NULL,
    address VARCHAR(128) NOT NULL,
    memo VARCHAR(128),
    crypto_amount NUMERIC(38, 18) NOT NULL,
    network_fee NUMERIC(38, 18) NOT NULL,
    provider_fee_charged NUMERIC(38, 18),
    rate_id UUID NOT NULL REFERENCES crypto_buy_rates (id) ON DELETE RESTRICT,
    unit_price naira_amount NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    naira_amount naira_amount NOT NULL,
    naira_fee naira_amount NOT NULL,
    total_naira naira_amount NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    failure_reason VARCHAR(255),
    tx_hash VARCHAR(128),
    hold_ledger_transaction_id UUID NOT NULL REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    final_ledger_transaction_id UUID REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_purchases_env_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT crypto_purchases_amounts_check CHECK (
        crypto_amount > 0 AND network_fee >= 0 AND unit_price > 0
        AND naira_amount > 0 AND naira_fee >= 0 AND total_naira = naira_amount + naira_fee
    ),
    CONSTRAINT crypto_purchases_status_check CHECK (
        status IN ('pending', 'processing', 'needs_review', 'completed', 'failed')
    ),
    CONSTRAINT crypto_purchases_final_has_ledger CHECK (
        (status IN ('completed', 'failed')) = (final_ledger_transaction_id IS NOT NULL)
    ),
    CONSTRAINT crypto_purchases_idempotency_unique UNIQUE (user_id, idempotency_key),
    CONSTRAINT crypto_purchases_reference_unique UNIQUE (provider, provider_reference),
    CONSTRAINT crypto_purchases_hold_unique UNIQUE (hold_ledger_transaction_id),
    CONSTRAINT crypto_purchases_final_unique UNIQUE (final_ledger_transaction_id)
);

CREATE INDEX crypto_purchases_user_idx ON crypto_purchases (user_id, created_at DESC);
CREATE INDEX crypto_purchases_open_idx ON crypto_purchases (status) WHERE status IN ('pending', 'processing');

CREATE FUNCTION crypto_purchases_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'failed') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'crypto_purchases: % is terminal and cannot become %', OLD.status, NEW.status;
    END IF;
    IF NEW.user_id <> OLD.user_id OR NEW.asset_id <> OLD.asset_id OR NEW.provider <> OLD.provider
        OR NEW.environment <> OLD.environment OR NEW.provider_asset_id <> OLD.provider_asset_id
        OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.address <> OLD.address
        OR NEW.memo IS DISTINCT FROM OLD.memo OR NEW.crypto_amount <> OLD.crypto_amount
        OR NEW.network_fee <> OLD.network_fee OR NEW.rate_id <> OLD.rate_id OR NEW.unit_price <> OLD.unit_price
        OR NEW.currency <> OLD.currency OR NEW.naira_amount <> OLD.naira_amount OR NEW.naira_fee <> OLD.naira_fee
        OR NEW.total_naira <> OLD.total_naira OR NEW.hold_ledger_transaction_id <> OLD.hold_ledger_transaction_id
        OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
        OR (OLD.final_ledger_transaction_id IS NOT NULL
            AND NEW.final_ledger_transaction_id IS DISTINCT FROM OLD.final_ledger_transaction_id) THEN
        RAISE EXCEPTION 'crypto_purchases: amounts, destination, price, provider and ledger links are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crypto_purchases_guard
    BEFORE UPDATE ON crypto_purchases
    FOR EACH ROW EXECUTE FUNCTION crypto_purchases_guard();

CREATE TRIGGER crypto_purchases_no_delete
    BEFORE DELETE ON crypto_purchases
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();

-- -----------------------------------------------------------------------------
-- Coin stock held at a provider, outside the (naira-only) ledger: top-ups
-- with what they cost us, and every send. Gives average cost, margin per
-- sale, and a check against the provider's reported balance. Append-only.
-- -----------------------------------------------------------------------------
CREATE TABLE crypto_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    quantity NUMERIC(38, 18) NOT NULL,
    naira_cost naira_amount,
    purchase_id UUID REFERENCES crypto_purchases (id) ON DELETE RESTRICT,
    note VARCHAR(255),
    recorded_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_stock_movements_kind_check CHECK (kind IN ('topup', 'send', 'adjustment')),
    CONSTRAINT crypto_stock_movements_shape_check CHECK (
        (kind = 'topup' AND quantity > 0 AND naira_cost IS NOT NULL AND naira_cost > 0 AND purchase_id IS NULL)
        OR (kind = 'send' AND quantity < 0 AND purchase_id IS NOT NULL)
        OR (kind = 'adjustment' AND quantity <> 0 AND purchase_id IS NULL)
    ),
    CONSTRAINT crypto_stock_movements_send_unique UNIQUE (purchase_id)
);

CREATE INDEX crypto_stock_movements_symbol_idx ON crypto_stock_movements (provider, symbol, created_at DESC);

CREATE TRIGGER crypto_stock_movements_append_only
    BEFORE UPDATE OR DELETE ON crypto_stock_movements
    FOR EACH ROW EXECUTE FUNCTION doviz_block_mutation();
