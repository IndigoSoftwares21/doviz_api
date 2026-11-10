CREATE OR REPLACE FUNCTION bank_withdrawals_guard() RETURNS trigger AS $$
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

DROP INDEX bank_withdrawals_fee_history_idx;

ALTER TABLE bank_withdrawals
    DROP CONSTRAINT bank_withdrawals_idempotency_unique,
    DROP CONSTRAINT bank_withdrawals_held_check,
    DROP CONSTRAINT bank_withdrawals_env_check,
    DROP COLUMN provider_bank_code,
    DROP COLUMN total_held,
    DROP COLUMN fee_reserve,
    DROP COLUMN idempotency_key,
    DROP COLUMN environment;

DROP TABLE provider_settings;
