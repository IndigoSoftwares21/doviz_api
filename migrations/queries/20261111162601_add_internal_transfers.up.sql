-- Ziks-to-Ziks transfers by Ziktag (INTERNAL_TRANSFERS_PLAN.md): instant and
-- free, one ledger posting user → user. No provider involved.

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal',
                 'bill_hold', 'bill_settle', 'bill_reversal', 'naira_deposit',
                 'crypto_purchase_hold', 'crypto_purchase_settle', 'crypto_purchase_reversal',
                 'internal_transfer')
    );

-- -----------------------------------------------------------------------------
-- Sending limits, in the database so ops can change them without a deploy
-- (npm run transfers:set-limits, audited). `scope` leaves room for per-user or
-- KYC-tier overrides later; 'default' applies to everyone today.
-- max_per_day is a rolling 24 hours of completed sends.
-- -----------------------------------------------------------------------------
CREATE TABLE transfer_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope VARCHAR(32) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    min_amount naira_amount NOT NULL,
    max_per_transfer naira_amount NOT NULL,
    max_per_day naira_amount NOT NULL,
    updated_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT transfer_limits_scope_unique UNIQUE (scope, currency),
    CONSTRAINT transfer_limits_amounts_check CHECK (
        min_amount > 0 AND max_per_transfer >= min_amount AND max_per_day >= min_amount
    )
);

INSERT INTO transfer_limits (scope, currency, min_amount, max_per_transfer, max_per_day, updated_by)
VALUES ('default', 'NGN', 100, 1000000, 1000000, 'migration');

-- -----------------------------------------------------------------------------
-- A transfer. Completed in the same transaction as its ledger posting — there
-- is no pending state. Tags are the ones used at the time (a later change of
-- tag doesn't rewrite history); sender_tag is null if the sender had none.
-- Amounts and parties are immutable; the only allowed change is
-- completed → reversed (an ops reversal, which posts its own ledger entry).
-- -----------------------------------------------------------------------------
CREATE TABLE internal_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    sender_tag VARCHAR(20),
    recipient_tag VARCHAR(20) NOT NULL,
    amount naira_amount NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    note VARCHAR(100),
    idempotency_key VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'completed',
    ledger_transaction_id UUID NOT NULL REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT internal_transfers_amount_check CHECK (amount > 0),
    CONSTRAINT internal_transfers_parties_check CHECK (sender_id <> recipient_id),
    CONSTRAINT internal_transfers_status_check CHECK (status IN ('completed', 'reversed')),
    CONSTRAINT internal_transfers_note_check CHECK (note IS NULL OR length(btrim(note)) BETWEEN 1 AND 100),
    CONSTRAINT internal_transfers_idempotency_unique UNIQUE (sender_id, idempotency_key),
    CONSTRAINT internal_transfers_ledger_unique UNIQUE (ledger_transaction_id)
);

CREATE INDEX internal_transfers_sender_idx ON internal_transfers (sender_id, created_at DESC);
CREATE INDEX internal_transfers_recipient_idx ON internal_transfers (recipient_id, created_at DESC);

CREATE FUNCTION internal_transfers_guard() RETURNS trigger AS $$
BEGIN
    IF NOT (OLD.status = 'completed' AND NEW.status = 'reversed') THEN
        RAISE EXCEPTION 'internal_transfers: only completed → reversed is allowed';
    END IF;
    IF NEW.sender_id <> OLD.sender_id OR NEW.recipient_id <> OLD.recipient_id
        OR NEW.sender_tag IS DISTINCT FROM OLD.sender_tag OR NEW.recipient_tag <> OLD.recipient_tag
        OR NEW.amount <> OLD.amount OR NEW.currency <> OLD.currency
        OR NEW.note IS DISTINCT FROM OLD.note OR NEW.idempotency_key <> OLD.idempotency_key
        OR NEW.ledger_transaction_id <> OLD.ledger_transaction_id OR NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'internal_transfers: amounts, parties, note and ledger link are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER internal_transfers_guard
    BEFORE UPDATE ON internal_transfers
    FOR EACH ROW EXECUTE FUNCTION internal_transfers_guard();

CREATE TRIGGER internal_transfers_no_delete
    BEFORE DELETE ON internal_transfers
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();

CREATE TRIGGER internal_transfers_no_truncate
    BEFORE TRUNCATE ON internal_transfers
    FOR EACH STATEMENT EXECUTE FUNCTION doviz_block_mutation();
