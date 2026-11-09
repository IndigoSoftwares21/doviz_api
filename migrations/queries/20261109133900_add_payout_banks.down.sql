-- Dev/test only. Never roll back a database holding real money.
DROP TABLE IF EXISTS user_bank_accounts;
DROP TABLE IF EXISTS provider_banks;
DROP TABLE IF EXISTS payout_banks;
DROP FUNCTION IF EXISTS user_bank_accounts_guard();
