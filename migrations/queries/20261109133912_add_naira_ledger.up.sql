-- Part of the crypto deposits → naira balance feature (provider-agnostic).
-- Money rules are enforced by the database; see each table's comments.

-- -----------------------------------------------------------------------------
-- Naira ledger (double-entry). `balance` is a cache of the account's entries,
-- maintained ONLY by the posting trigger.
--   user_available      — a user's naira balance (never negative)
--   provider_clearing   — per provider: Doviz's naira held at that provider
--   payouts_in_transit  — per provider: withdrawals sent, not yet final
--   markup_revenue      — Doviz's conversion markup income
-- -----------------------------------------------------------------------------
CREATE TABLE ledger_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(32) NOT NULL,
    user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
    provider VARCHAR(32),
    currency VARCHAR(3) NOT NULL,
    balance naira_amount NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ledger_accounts_kind_check CHECK (
        kind IN ('user_available', 'provider_clearing', 'payouts_in_transit', 'markup_revenue')
    ),
    CONSTRAINT ledger_accounts_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ledger_accounts_owner_check CHECK ((kind = 'user_available') = (user_id IS NOT NULL)),
    CONSTRAINT ledger_accounts_provider_check CHECK (
        (kind IN ('provider_clearing', 'payouts_in_transit')) = (provider IS NOT NULL)
    ),
    CONSTRAINT ledger_accounts_user_non_negative CHECK (kind <> 'user_available' OR balance >= 0)
);

CREATE UNIQUE INDEX ledger_accounts_user_unique
    ON ledger_accounts (kind, user_id, currency) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_accounts_system_unique
    ON ledger_accounts (kind, coalesce(provider, ''), currency) WHERE user_id IS NULL;

CREATE FUNCTION ledger_accounts_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'ledger_accounts: accounts are never deleted';
    END IF;
    IF NEW.balance IS DISTINCT FROM OLD.balance
        AND coalesce(current_setting('doviz.ledger_posting', true), '') <> 'on' THEN
        RAISE EXCEPTION 'ledger_accounts: balance changes only by posting ledger entries';
    END IF;
    IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.provider IS DISTINCT FROM OLD.provider OR NEW.currency IS DISTINCT FROM OLD.currency THEN
        RAISE EXCEPTION 'ledger_accounts: kind, owner, provider and currency are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_accounts_guard BEFORE UPDATE OR DELETE ON ledger_accounts
    FOR EACH ROW EXECUTE FUNCTION ledger_accounts_guard();
