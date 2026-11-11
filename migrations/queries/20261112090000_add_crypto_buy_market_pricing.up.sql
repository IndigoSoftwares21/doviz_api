-- Buying coins priced from the market (USDC, ETH…): our hand-set USDT naira
-- rate × the coin's live USDT price at the provider × (1 + its markup).
-- USDT itself (and any coin with its own rate in force) keeps a set rate.

-- -----------------------------------------------------------------------------
-- Per-coin markup for market-priced coins. Changed with
-- npm run crypto:set-buy-markup (audited); applies to the next quote.
-- -----------------------------------------------------------------------------
CREATE TABLE crypto_buy_markups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(16) NOT NULL,
    markup_percent NUMERIC(6, 3) NOT NULL,
    note VARCHAR(255),
    updated_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_buy_markups_symbol_unique UNIQUE (symbol),
    CONSTRAINT crypto_buy_markups_symbol_check CHECK (symbol ~ '^[A-Z0-9]{2,16}$'),
    CONSTRAINT crypto_buy_markups_percent_check CHECK (markup_percent >= 0 AND markup_percent <= 20)
);

INSERT INTO crypto_buy_markups (symbol, markup_percent, note, updated_by) VALUES
    ('USDC', 0, 'Stablecoin: the market price is enough', 'migration'),
    ('ETH', 1.5, 'Covers price movement between quote and restock', 'migration');

-- -----------------------------------------------------------------------------
-- How each purchase was priced, kept with it for ever:
--   price_source 'rate'   — a rate we set for this coin (rate_id);
--                'market' — rate_id is the USDT rate, market_price_usdt the
--                           coin's USDT price used, markup_percent the total markup.
-- Existing purchases were all priced from their own rate.
-- -----------------------------------------------------------------------------
ALTER TABLE crypto_purchases
    ADD COLUMN price_source VARCHAR(16) NOT NULL DEFAULT 'rate',
    ADD COLUMN market_price_usdt NUMERIC(36, 18),
    ADD COLUMN markup_percent NUMERIC(6, 3),
    ADD CONSTRAINT crypto_purchases_price_source_check CHECK (price_source IN ('rate', 'market')),
    ADD CONSTRAINT crypto_purchases_market_price_check CHECK (
        (price_source = 'market' AND market_price_usdt > 0) OR (price_source = 'rate' AND market_price_usdt IS NULL)
    ),
    ADD CONSTRAINT crypto_purchases_markup_check CHECK (markup_percent IS NULL OR (markup_percent >= 0 AND markup_percent <= 40));

CREATE OR REPLACE FUNCTION crypto_purchases_guard() RETURNS trigger AS $$
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
        OR NEW.price_source <> OLD.price_source
        OR NEW.market_price_usdt IS DISTINCT FROM OLD.market_price_usdt
        OR NEW.markup_percent IS DISTINCT FROM OLD.markup_percent
        OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
        OR (OLD.final_ledger_transaction_id IS NOT NULL
            AND NEW.final_ledger_transaction_id IS DISTINCT FROM OLD.final_ledger_transaction_id) THEN
        RAISE EXCEPTION 'crypto_purchases: amounts, destination, price, provider and ledger links are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
