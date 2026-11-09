-- Part of the crypto deposits → naira balance feature (provider-agnostic).
-- Money rules are enforced by the database; see each table's comments.

-- -----------------------------------------------------------------------------
-- Banks (provider-neutral, by CBN/NIP code), each provider's id for them,
-- and the user's verified bank accounts for withdrawals.
-- -----------------------------------------------------------------------------
CREATE TABLE payout_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(16) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payout_banks_code_unique UNIQUE (code)
);

CREATE TABLE provider_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_bank_id UUID NOT NULL REFERENCES payout_banks (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    provider_bank_id VARCHAR(64) NOT NULL,
    synced_at TIMESTAMPTZ,
    CONSTRAINT provider_banks_env_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT provider_banks_bank_unique UNIQUE (provider, environment, payout_bank_id),
    CONSTRAINT provider_banks_provider_id_unique UNIQUE (provider, environment, provider_bank_id)
);

-- The account name from the bank lookup must match the user's legal name.
CREATE TABLE user_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    payout_bank_id UUID NOT NULL REFERENCES payout_banks (id) ON DELETE RESTRICT,
    account_number VARCHAR(10) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    verified_at TIMESTAMPTZ NOT NULL,
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_bank_accounts_nuban_check CHECK (account_number ~ '^[0-9]{10}$'),
    CONSTRAINT user_bank_accounts_status_check CHECK (status IN ('active', 'removed')),
    CONSTRAINT user_bank_accounts_primary_active CHECK (NOT is_primary OR status = 'active')
);

CREATE UNIQUE INDEX user_bank_accounts_one_primary ON user_bank_accounts (user_id) WHERE is_primary;
CREATE UNIQUE INDEX user_bank_accounts_active_unique
    ON user_bank_accounts (user_id, payout_bank_id, account_number) WHERE status = 'active';

CREATE FUNCTION user_bank_accounts_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.user_id <> OLD.user_id OR NEW.payout_bank_id <> OLD.payout_bank_id
        OR NEW.account_number <> OLD.account_number OR NEW.account_name <> OLD.account_name THEN
        RAISE EXCEPTION 'user_bank_accounts: bank details are immutable; add a new account instead';
    END IF;
    IF OLD.status = 'removed' AND NEW.status <> 'removed' THEN
        RAISE EXCEPTION 'user_bank_accounts: a removed account cannot be restored';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_bank_accounts_guard BEFORE UPDATE ON user_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION user_bank_accounts_guard();
CREATE TRIGGER user_bank_accounts_no_delete BEFORE DELETE ON user_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();
