-- Withdrawals can now go to ANY bank account (behind the
-- bank_transfers_to_others setting), not only the user's own saved ones.
-- Exactly one destination: a saved account (bank_account_id), or a recipient
-- looked up at the time (bank + number + the name the bank returned).
-- `narration` is what the recipient's bank shows (the user's own text for a
-- transfer to someone else). None of it can change once recorded.
ALTER TABLE bank_withdrawals
    ALTER COLUMN bank_account_id DROP NOT NULL,
    ADD COLUMN recipient_payout_bank_id UUID REFERENCES payout_banks (id) ON DELETE RESTRICT,
    ADD COLUMN recipient_account_number VARCHAR(20),
    ADD COLUMN recipient_account_name VARCHAR(150),
    ADD COLUMN narration VARCHAR(100),
    ADD CONSTRAINT bank_withdrawals_destination_check CHECK (
        (bank_account_id IS NOT NULL AND recipient_payout_bank_id IS NULL AND recipient_account_number IS NULL AND recipient_account_name IS NULL)
        OR (bank_account_id IS NULL AND recipient_payout_bank_id IS NOT NULL AND recipient_account_number IS NOT NULL AND recipient_account_name IS NOT NULL)
    );

CREATE FUNCTION bank_withdrawals_recipient_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id
        OR NEW.recipient_payout_bank_id IS DISTINCT FROM OLD.recipient_payout_bank_id
        OR NEW.recipient_account_number IS DISTINCT FROM OLD.recipient_account_number
        OR NEW.recipient_account_name IS DISTINCT FROM OLD.recipient_account_name
        OR NEW.narration IS DISTINCT FROM OLD.narration THEN
        RAISE EXCEPTION 'bank_withdrawals: the destination and narration cannot change';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_withdrawals_recipient_guard BEFORE UPDATE ON bank_withdrawals
    FOR EACH ROW EXECUTE FUNCTION bank_withdrawals_recipient_guard();

-- On by default; switch off with `npm run settings:set -- bank_transfers_to_others off`.
INSERT INTO app_settings (key, value) VALUES ('bank_transfers_to_others', 'on') ON CONFLICT (key) DO NOTHING;
