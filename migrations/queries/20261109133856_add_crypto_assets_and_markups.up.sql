-- Part of the crypto deposits → naira balance feature (provider-agnostic).
-- Money rules are enforced by the database; see each table's comments.

-- Naira amounts: exact to the kobo. Unlike NUMERIC(20,2), which silently
-- ROUNDS extra decimals, this REJECTS them — rounding money must always be an
-- explicit decision in code, never a side effect of storage.
CREATE DOMAIN naira_amount AS NUMERIC
    CHECK (VALUE IS NULL OR (scale(VALUE) <= 2 AND abs(VALUE) < 1000000000000000));

-- Shared guards used by every money table in this feature.
CREATE FUNCTION doviz_block_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '%: rows are never deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION doviz_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Coins we accept (provider-neutral) and each provider's mapping for them.
-- -----------------------------------------------------------------------------
CREATE TABLE crypto_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(16) NOT NULL,
    network VARCHAR(32) NOT NULL,
    name VARCHAR(64) NOT NULL,
    decimals SMALLINT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_assets_decimals_check CHECK (decimals BETWEEN 0 AND 18),
    CONSTRAINT crypto_assets_symbol_network_unique UNIQUE (symbol, network)
);

CREATE TABLE crypto_provider_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES crypto_assets (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    provider_asset_id VARCHAR(64) NOT NULL,
    provider_code VARCHAR(64) NOT NULL,
    min_deposit NUMERIC(38, 18),
    confirmations SMALLINT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_provider_assets_env_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT crypto_provider_assets_min_check CHECK (min_deposit IS NULL OR min_deposit >= 0),
    CONSTRAINT crypto_provider_assets_asset_unique UNIQUE (provider, environment, asset_id),
    CONSTRAINT crypto_provider_assets_provider_id_unique UNIQUE (provider, environment, provider_asset_id)
);

-- -----------------------------------------------------------------------------
-- Doviz's markup per coin when converting to naira. Append-only history: a
-- change is a new row with a later effective_from; past deposits keep the
-- markup they were credited with.
-- -----------------------------------------------------------------------------
CREATE TABLE conversion_markups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES crypto_assets (id) ON DELETE RESTRICT,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    markup_percent NUMERIC(6, 3) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    note VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversion_markups_percent_check CHECK (markup_percent >= 0 AND markup_percent <= 20),
    CONSTRAINT conversion_markups_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT conversion_markups_effective_unique UNIQUE (asset_id, currency, effective_from)
);

CREATE TRIGGER conversion_markups_append_only
    BEFORE UPDATE OR DELETE ON conversion_markups
    FOR EACH ROW EXECUTE FUNCTION doviz_block_mutation();
