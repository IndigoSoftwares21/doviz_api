-- Part of the crypto deposits → naira balance feature (provider-agnostic).
-- Money rules are enforced by the database; see each table's comments.

-- Ledger postings: transactions (one per business event, idempotent) and
-- their entries. Entries move account balances via trigger, must balance to
-- zero per currency at COMMIT, and are append-only.
CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    description VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ledger_transactions_idempotency_unique UNIQUE (idempotency_key),
    CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal')
    )
);

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES ledger_accounts (id) ON DELETE RESTRICT,
    currency VARCHAR(3) NOT NULL,
    amount naira_amount NOT NULL,
    balance_after naira_amount NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ledger_entries_non_zero CHECK (amount <> 0)
);

CREATE INDEX ledger_entries_account_idx ON ledger_entries (account_id, created_at);
CREATE INDEX ledger_entries_transaction_idx ON ledger_entries (transaction_id);

-- Posting: lock the account, check currency, move the cached balance, stamp
-- balance_after. The user_non_negative CHECK rejects overdrafts.
CREATE FUNCTION ledger_entries_post() RETURNS trigger AS $$
DECLARE
    account ledger_accounts%ROWTYPE;
BEGIN
    SELECT * INTO account FROM ledger_accounts WHERE id = NEW.account_id FOR UPDATE;
    IF account.currency <> NEW.currency THEN
        RAISE EXCEPTION 'ledger_entries: entry currency does not match account currency';
    END IF;
    NEW.balance_after := account.balance + NEW.amount;
    PERFORM set_config('doviz.ledger_posting', 'on', true);
    UPDATE ledger_accounts SET balance = NEW.balance_after, updated_at = now() WHERE id = NEW.account_id;
    PERFORM set_config('doviz.ledger_posting', 'off', true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_post BEFORE INSERT ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION ledger_entries_post();

-- Every transaction: >= 2 entries and zero-sum per currency, checked at COMMIT.
CREATE FUNCTION ledger_entries_check_balanced() RETURNS trigger AS $$
DECLARE
    entry_count INTEGER;
    unbalanced_currency VARCHAR(3);
BEGIN
    SELECT count(*) INTO entry_count FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
    IF entry_count < 2 THEN
        RAISE EXCEPTION 'ledger transaction % has fewer than 2 entries', NEW.transaction_id;
    END IF;
    SELECT currency INTO unbalanced_currency FROM ledger_entries
    WHERE transaction_id = NEW.transaction_id GROUP BY currency HAVING sum(amount) <> 0 LIMIT 1;
    IF unbalanced_currency IS NOT NULL THEN
        RAISE EXCEPTION 'ledger transaction % does not balance for %', NEW.transaction_id, unbalanced_currency;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced AFTER INSERT ON ledger_entries
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_entries_check_balanced();

CREATE TRIGGER ledger_transactions_append_only BEFORE UPDATE OR DELETE ON ledger_transactions
    FOR EACH ROW EXECUTE FUNCTION doviz_block_mutation();
CREATE TRIGGER ledger_transactions_no_truncate BEFORE TRUNCATE ON ledger_transactions
    FOR EACH STATEMENT EXECUTE FUNCTION doviz_block_mutation();
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION doviz_block_mutation();
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON ledger_entries
    FOR EACH STATEMENT EXECUTE FUNCTION doviz_block_mutation();
