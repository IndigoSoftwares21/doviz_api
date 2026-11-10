-- Withdrawals to the user's own bank (WITHDRAWALS_PLAN.md). Provider-agnostic;
-- Korapay first. No table or column is named after a provider.

-- -----------------------------------------------------------------------------
-- Which provider a service uses for NEW work, switchable without a deploy.
-- Read for every new withdrawal; in-flight ones keep the provider on their row.
-- Every change is also written to audit_logs.
-- -----------------------------------------------------------------------------
CREATE TABLE provider_settings (
    service VARCHAR(32) PRIMARY KEY,
    active_provider VARCHAR(32) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT provider_settings_service_check CHECK (service IN ('payouts'))
);

INSERT INTO provider_settings (service, active_provider) VALUES ('payouts', 'korapay');

-- -----------------------------------------------------------------------------
-- bank_withdrawals (created with the crypto work, unused until now) gets what a
-- real payout needs. The money held is amount + fee_reserve (the reserve covers
-- the provider's fee, which most providers only report after sending); the
-- real fee is charged at settlement and any unused reserve goes straight back.
-- -----------------------------------------------------------------------------
ALTER TABLE bank_withdrawals
    ADD COLUMN environment VARCHAR(16) NOT NULL DEFAULT 'sandbox',
    ADD COLUMN idempotency_key VARCHAR(64) NOT NULL,
    ADD COLUMN fee_reserve naira_amount NOT NULL DEFAULT 0.00,
    ADD COLUMN total_held naira_amount NOT NULL,
    ADD COLUMN provider_bank_code VARCHAR(16) NOT NULL,
    ADD CONSTRAINT bank_withdrawals_env_check CHECK (environment IN ('sandbox', 'production')),
    ADD CONSTRAINT bank_withdrawals_held_check CHECK (fee_reserve >= 0 AND total_held = amount + fee_reserve),
    ADD CONSTRAINT bank_withdrawals_idempotency_unique UNIQUE (user_id, idempotency_key);

ALTER TABLE bank_withdrawals ALTER COLUMN environment DROP DEFAULT;

CREATE INDEX bank_withdrawals_fee_history_idx ON bank_withdrawals (provider, environment, finalized_at DESC) WHERE status = 'completed';

-- What the user was charged and paid out can't change once the money is held.
CREATE OR REPLACE FUNCTION bank_withdrawals_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'reversed', 'rejected', 'failed') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'bank_withdrawals: % is terminal and cannot become %', OLD.status, NEW.status;
    END IF;
    IF NEW.amount <> OLD.amount OR NEW.user_id <> OLD.user_id OR NEW.bank_account_id <> OLD.bank_account_id
        OR NEW.provider <> OLD.provider OR NEW.environment <> OLD.environment OR NEW.currency <> OLD.currency
        OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.fee_reserve <> OLD.fee_reserve
        OR NEW.total_held <> OLD.total_held OR NEW.provider_bank_code <> OLD.provider_bank_code
        OR NEW.hold_ledger_transaction_id <> OLD.hold_ledger_transaction_id
        OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
        OR (OLD.fee IS NOT NULL AND NEW.fee IS DISTINCT FROM OLD.fee)
        OR (OLD.final_ledger_transaction_id IS NOT NULL
            AND NEW.final_ledger_transaction_id IS DISTINCT FROM OLD.final_ledger_transaction_id) THEN
        RAISE EXCEPTION 'bank_withdrawals: amounts, destination, provider and ledger links are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
