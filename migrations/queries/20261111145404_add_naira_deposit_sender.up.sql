-- Who sent a naira top-up, as the provider reports it (the external account
-- the money came from — never our own collection account). Set when the
-- deposit is credited; null when the provider doesn't say. The account
-- number is stored masked (last 4 digits only).
ALTER TABLE naira_deposits
    ADD COLUMN sender_name VARCHAR(128),
    ADD COLUMN sender_bank_name VARCHAR(128),
    ADD COLUMN sender_bank_code VARCHAR(16),
    ADD COLUMN sender_account_number VARCHAR(32);
