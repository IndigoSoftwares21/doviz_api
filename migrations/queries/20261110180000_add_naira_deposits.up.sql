-- Part of the naira deposits feature (provider-agnostic; Korapay first).
-- See NAIRA_DEPOSITS_PLAN.md. No table or column is named after a provider.

-- provider_fees — per provider: fees Doviz absorbed (only when Doviz bears them).
ALTER TABLE ledger_accounts
    DROP CONSTRAINT ledger_accounts_kind_check,
    DROP CONSTRAINT ledger_accounts_provider_check,
    ADD CONSTRAINT ledger_accounts_kind_check CHECK (
        kind IN ('user_available', 'provider_clearing', 'payouts_in_transit', 'markup_revenue',
                 'bills_in_transit', 'bill_revenue', 'provider_fees')
    ),
    ADD CONSTRAINT ledger_accounts_provider_check CHECK (
        (kind IN ('provider_clearing', 'payouts_in_transit', 'bills_in_transit', 'provider_fees')) = (provider IS NOT NULL)
    );

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal',
                 'bill_hold', 'bill_settle', 'bill_reversal', 'naira_deposit')
    );

-- -----------------------------------------------------------------------------
-- Naira deposits by bank transfer to a one-time account from the provider.
-- `id` is sent to the provider as our reference. No money moves until the
-- provider confirms the transfer; then one ledger posting credits the user.
--   pending   — row made; account issued (or being issued); waiting for the transfer
--   expired   — the account lapsed unpaid (a late payment can still complete it)
--   completed — provider confirmed; user credited (carries the ledger link)
--   failed    — the provider couldn't issue an account, or reported the charge failed
-- `amount` = what the user asked to receive. `fee` / `amount_to_transfer` are
-- the provider's quote at creation; `fee_bearer` is snapshotted so a config
-- change never touches an open deposit.
-- -----------------------------------------------------------------------------
CREATE TABLE naira_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    provider_reference VARCHAR(128),
    idempotency_key VARCHAR(64) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    amount money_amount NOT NULL,
    fee_bearer VARCHAR(8) NOT NULL,
    fee money_amount,
    amount_to_transfer money_amount,
    account_name VARCHAR(150),
    account_number VARCHAR(20),
    bank_name VARCHAR(100),
    expires_at TIMESTAMPTZ,
    amount_received money_amount,
    provider_fee money_amount,
    amount_credited money_amount,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    failure_reason VARCHAR(255),
    ledger_transaction_id UUID REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    paid_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT naira_deposits_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT naira_deposits_fee_bearer_check CHECK (fee_bearer IN ('user', 'doviz')),
    CONSTRAINT naira_deposits_amount_check CHECK (
        amount > 0
        AND (fee IS NULL OR fee >= 0)
        AND (amount_to_transfer IS NULL OR amount_to_transfer > 0)
        AND (amount_received IS NULL OR amount_received > 0)
        AND (provider_fee IS NULL OR provider_fee >= 0)
        AND (amount_credited IS NULL OR amount_credited > 0)
    ),
    CONSTRAINT naira_deposits_status_check CHECK (status IN ('pending', 'expired', 'completed', 'failed')),
    CONSTRAINT naira_deposits_completed_check CHECK (
        (status = 'completed') = (ledger_transaction_id IS NOT NULL)
        AND (status <> 'completed' OR (amount_received IS NOT NULL AND amount_credited IS NOT NULL AND provider_fee IS NOT NULL))
    ),
    CONSTRAINT naira_deposits_idempotency_unique UNIQUE (user_id, idempotency_key),
    CONSTRAINT naira_deposits_reference_unique UNIQUE (provider, provider_reference),
    CONSTRAINT naira_deposits_ledger_unique UNIQUE (ledger_transaction_id)
);

CREATE INDEX naira_deposits_user_idx ON naira_deposits (user_id, created_at DESC);
CREATE INDEX naira_deposits_open_idx ON naira_deposits (status, updated_at) WHERE status IN ('pending', 'expired');

-- Terminal: completed, failed. expired may still become completed (late payment).
-- What the user asked for, the quote they were shown and the ledger link never change.
CREATE FUNCTION naira_deposits_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'failed') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'naira_deposits: % is terminal and cannot become %', OLD.status, NEW.status;
    END IF;
    IF OLD.status = 'expired' AND NEW.status NOT IN ('expired', 'completed') THEN
        RAISE EXCEPTION 'naira_deposits: expired can only become completed';
    END IF;
    IF NEW.user_id <> OLD.user_id OR NEW.provider <> OLD.provider OR NEW.idempotency_key <> OLD.idempotency_key
        OR NEW.currency <> OLD.currency OR NEW.amount <> OLD.amount OR NEW.fee_bearer <> OLD.fee_bearer
        OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
        OR (OLD.fee IS NOT NULL AND NEW.fee IS DISTINCT FROM OLD.fee)
        OR (OLD.amount_to_transfer IS NOT NULL AND NEW.amount_to_transfer IS DISTINCT FROM OLD.amount_to_transfer)
        OR (OLD.account_number IS NOT NULL AND NEW.account_number IS DISTINCT FROM OLD.account_number)
        OR (OLD.ledger_transaction_id IS NOT NULL AND NEW.ledger_transaction_id IS DISTINCT FROM OLD.ledger_transaction_id) THEN
        RAISE EXCEPTION 'naira_deposits: amounts, quote, account and ledger links are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER naira_deposits_guard BEFORE UPDATE ON naira_deposits
    FOR EACH ROW EXECUTE FUNCTION naira_deposits_guard();
CREATE TRIGGER naira_deposits_no_delete BEFORE DELETE ON naira_deposits
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();
