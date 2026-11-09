-- Part of the crypto deposits → naira balance feature (provider-agnostic).
-- Money rules are enforced by the database; see each table's comments.

-- -----------------------------------------------------------------------------
-- Deposits. Figures come from the provider's own record (fetched by id).
--   gross_ngn  — naira the provider credited to Doviz for this deposit
--   markup_ngn — Doviz's markup (markup_percent of gross, from conversion_markups)
--   net_ngn    — credited to the user's naira balance
-- "completed" is only ever set together with the credit (same transaction).
-- -----------------------------------------------------------------------------
CREATE TABLE crypto_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    provider_reference VARCHAR(64) NOT NULL,
    wallet_id UUID NOT NULL REFERENCES crypto_wallets (id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    asset_id UUID NOT NULL REFERENCES crypto_assets (id) ON DELETE RESTRICT,
    status VARCHAR(16) NOT NULL,
    sub_status VARCHAR(32),
    crypto_amount NUMERIC(38, 18) NOT NULL,
    reported_usd naira_amount,
    rate_ngn_per_usd NUMERIC(20, 6),
    gross_ngn naira_amount,
    conversion_markup_id UUID REFERENCES conversion_markups (id) ON DELETE RESTRICT,
    markup_percent NUMERIC(6, 3),
    markup_ngn naira_amount,
    net_ngn naira_amount,
    ledger_transaction_id UUID REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    tx_hash VARCHAR(128),
    sender_address VARCHAR(128),
    confirmations INTEGER,
    aml_passed BOOLEAN,
    last_event_at TIMESTAMPTZ,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_deposits_reference_unique UNIQUE (provider, provider_reference),
    CONSTRAINT crypto_deposits_ledger_unique UNIQUE (ledger_transaction_id),
    CONSTRAINT crypto_deposits_status_check CHECK (status IN ('pending', 'flagged', 'completed', 'deleted')),
    CONSTRAINT crypto_deposits_amounts_check CHECK (
        crypto_amount >= 0 AND (gross_ngn IS NULL OR gross_ngn >= 0)
        AND (markup_ngn IS NULL OR markup_ngn >= 0) AND (net_ngn IS NULL OR net_ngn >= 0)
    ),
    CONSTRAINT crypto_deposits_net_is_gross_minus_markup CHECK (
        gross_ngn IS NULL OR markup_ngn IS NULL OR net_ngn IS NULL OR net_ngn = gross_ngn - markup_ngn
    ),
    CONSTRAINT crypto_deposits_completed_is_credited CHECK (
        (status = 'completed') = (ledger_transaction_id IS NOT NULL)
    ),
    CONSTRAINT crypto_deposits_completed_has_figures CHECK (
        status <> 'completed'
        OR (gross_ngn IS NOT NULL AND markup_ngn IS NOT NULL AND net_ngn IS NOT NULL
            AND markup_percent IS NOT NULL AND conversion_markup_id IS NOT NULL)
    )
);

CREATE INDEX crypto_deposits_user_idx ON crypto_deposits (user_id, created_at DESC);
CREATE INDEX crypto_deposits_open_idx ON crypto_deposits (status) WHERE status IN ('pending', 'flagged');

CREATE FUNCTION crypto_deposits_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'deleted') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'crypto_deposits: % is terminal and cannot become %', OLD.status, NEW.status;
    END IF;
    IF OLD.status = 'completed' AND (
        NEW.crypto_amount <> OLD.crypto_amount OR NEW.gross_ngn IS DISTINCT FROM OLD.gross_ngn
        OR NEW.markup_ngn IS DISTINCT FROM OLD.markup_ngn OR NEW.net_ngn IS DISTINCT FROM OLD.net_ngn
        OR NEW.markup_percent IS DISTINCT FROM OLD.markup_percent
        OR NEW.rate_ngn_per_usd IS DISTINCT FROM OLD.rate_ngn_per_usd
        OR NEW.ledger_transaction_id IS DISTINCT FROM OLD.ledger_transaction_id
    ) THEN
        RAISE EXCEPTION 'crypto_deposits: a credited deposit is frozen';
    END IF;
    IF NEW.provider <> OLD.provider OR NEW.provider_reference <> OLD.provider_reference
        OR NEW.wallet_id <> OLD.wallet_id OR NEW.user_id <> OLD.user_id OR NEW.asset_id <> OLD.asset_id THEN
        RAISE EXCEPTION 'crypto_deposits: identity columns are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crypto_deposits_guard BEFORE UPDATE ON crypto_deposits
    FOR EACH ROW EXECUTE FUNCTION crypto_deposits_guard();
CREATE TRIGGER crypto_deposits_no_delete BEFORE DELETE ON crypto_deposits
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();
