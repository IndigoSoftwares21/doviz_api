-- Part of the crypto deposits → naira balance feature (provider-agnostic).
-- Money rules are enforced by the database; see each table's comments.

-- -----------------------------------------------------------------------------
-- Withdrawals of naira to the user's bank. The money is HELD (moved to
-- payouts_in_transit) before the provider is called; completion settles the
-- hold, a reversal/rejection/failure refunds it. `id` is sent to the provider
-- as our external reference, so a timed-out request can be looked up.
-- -----------------------------------------------------------------------------
CREATE TABLE bank_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL REFERENCES user_bank_accounts (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    provider_reference VARCHAR(64),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    amount naira_amount NOT NULL,
    fee naira_amount,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    failure_reason VARCHAR(255),
    hold_ledger_transaction_id UUID NOT NULL REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    final_ledger_transaction_id UUID REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bank_withdrawals_amount_check CHECK (amount > 0 AND (fee IS NULL OR fee >= 0)),
    CONSTRAINT bank_withdrawals_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'reversed', 'rejected', 'failed')
    ),
    CONSTRAINT bank_withdrawals_final_has_ledger CHECK (
        (status IN ('completed', 'reversed', 'rejected', 'failed')) = (final_ledger_transaction_id IS NOT NULL)
    ),
    CONSTRAINT bank_withdrawals_reference_unique UNIQUE (provider, provider_reference),
    CONSTRAINT bank_withdrawals_hold_unique UNIQUE (hold_ledger_transaction_id),
    CONSTRAINT bank_withdrawals_final_unique UNIQUE (final_ledger_transaction_id)
);

CREATE INDEX bank_withdrawals_user_idx ON bank_withdrawals (user_id, created_at DESC);
CREATE INDEX bank_withdrawals_open_idx ON bank_withdrawals (status) WHERE status IN ('pending', 'processing');

CREATE FUNCTION bank_withdrawals_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'reversed', 'rejected', 'failed') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'bank_withdrawals: % is terminal and cannot become %', OLD.status, NEW.status;
    END IF;
    IF NEW.amount <> OLD.amount OR NEW.user_id <> OLD.user_id OR NEW.bank_account_id <> OLD.bank_account_id
        OR NEW.provider <> OLD.provider OR NEW.currency <> OLD.currency
        OR NEW.hold_ledger_transaction_id <> OLD.hold_ledger_transaction_id
        OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
        OR (OLD.final_ledger_transaction_id IS NOT NULL
            AND NEW.final_ledger_transaction_id IS DISTINCT FROM OLD.final_ledger_transaction_id) THEN
        RAISE EXCEPTION 'bank_withdrawals: amount, destination and ledger links are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_withdrawals_guard BEFORE UPDATE ON bank_withdrawals
    FOR EACH ROW EXECUTE FUNCTION bank_withdrawals_guard();
CREATE TRIGGER bank_withdrawals_no_delete BEFORE DELETE ON bank_withdrawals
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();

-- -----------------------------------------------------------------------------
-- Inbound provider webhooks, stored before processing and deduped per
-- provider. Secrets/signatures are never stored.
-- -----------------------------------------------------------------------------
CREATE TABLE provider_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64),
    event_time TIMESTAMPTZ,
    payload JSONB NOT NULL,
    source_ip VARCHAR(45),
    status VARCHAR(16) NOT NULL DEFAULT 'received',
    attempts SMALLINT NOT NULL DEFAULT 0,
    last_error VARCHAR(500),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT provider_webhook_events_event_unique UNIQUE (provider, event_id),
    CONSTRAINT provider_webhook_events_status_check CHECK (status IN ('received', 'processed', 'ignored', 'failed'))
);

CREATE INDEX provider_webhook_events_pending_idx
    ON provider_webhook_events (received_at) WHERE status IN ('received', 'failed');
CREATE TRIGGER provider_webhook_events_no_delete BEFORE DELETE ON provider_webhook_events
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();
