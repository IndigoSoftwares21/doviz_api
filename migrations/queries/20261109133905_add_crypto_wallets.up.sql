-- Part of the crypto deposits → naira balance feature (provider-agnostic).
-- Money rules are enforced by the database; see each table's comments.

-- -----------------------------------------------------------------------------
-- Deposit addresses: one CURRENT address per user, asset AND provider (after
-- a provider switch a user can hold two USDT-TRC20 addresses, both live);
-- exactly one primary per asset (the one the app shows). Created 'pending'
-- before calling the provider; the label is derived from our id so retries
-- reuse it.
-- -----------------------------------------------------------------------------
CREATE TABLE crypto_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    asset_id UUID NOT NULL REFERENCES crypto_assets (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    label VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    address VARCHAR(128),
    provider_wallet_id VARCHAR(64),
    activated_at TIMESTAMPTZ,
    retired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_wallets_status_check CHECK (status IN ('pending', 'active', 'retired', 'failed')),
    CONSTRAINT crypto_wallets_has_address CHECK (
        status NOT IN ('active', 'retired') OR (address IS NOT NULL AND provider_wallet_id IS NOT NULL)
    ),
    CONSTRAINT crypto_wallets_primary_is_current CHECK (NOT is_primary OR status IN ('pending', 'active')),
    CONSTRAINT crypto_wallets_label_unique UNIQUE (provider, label),
    CONSTRAINT crypto_wallets_provider_wallet_unique UNIQUE (provider, provider_wallet_id)
);

CREATE UNIQUE INDEX crypto_wallets_one_current_per_provider
    ON crypto_wallets (user_id, asset_id, provider) WHERE status IN ('pending', 'active');
CREATE UNIQUE INDEX crypto_wallets_one_primary ON crypto_wallets (user_id, asset_id) WHERE is_primary;
CREATE UNIQUE INDEX crypto_wallets_provider_address_unique
    ON crypto_wallets (provider, asset_id, address) WHERE address IS NOT NULL;

CREATE FUNCTION crypto_wallets_guard() RETURNS trigger AS $$
BEGIN
    IF (OLD.address IS NOT NULL AND NEW.address IS DISTINCT FROM OLD.address)
        OR (OLD.provider_wallet_id IS NOT NULL AND NEW.provider_wallet_id IS DISTINCT FROM OLD.provider_wallet_id)
        OR NEW.provider <> OLD.provider OR NEW.user_id <> OLD.user_id OR NEW.asset_id <> OLD.asset_id
        OR NEW.label <> OLD.label THEN
        RAISE EXCEPTION 'crypto_wallets: address, provider, owner and label are immutable once set';
    END IF;
    IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
        RAISE EXCEPTION 'crypto_wallets: a retired address cannot be reactivated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crypto_wallets_guard BEFORE UPDATE ON crypto_wallets
    FOR EACH ROW EXECUTE FUNCTION crypto_wallets_guard();
CREATE TRIGGER crypto_wallets_no_delete BEFORE DELETE ON crypto_wallets
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();
