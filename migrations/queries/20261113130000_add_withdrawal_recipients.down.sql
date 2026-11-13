DELETE FROM app_settings WHERE key = 'bank_transfers_to_others';
DROP TRIGGER IF EXISTS bank_withdrawals_recipient_guard ON bank_withdrawals;
DROP FUNCTION IF EXISTS bank_withdrawals_recipient_guard();
ALTER TABLE bank_withdrawals
    DROP CONSTRAINT IF EXISTS bank_withdrawals_destination_check,
    DROP COLUMN IF EXISTS narration,
    DROP COLUMN IF EXISTS recipient_account_name,
    DROP COLUMN IF EXISTS recipient_account_number,
    DROP COLUMN IF EXISTS recipient_payout_bank_id,
    ALTER COLUMN bank_account_id SET NOT NULL;
