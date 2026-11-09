-- Dev/test only. Never roll back a database holding real money.
DROP TABLE IF EXISTS ledger_accounts;
DROP FUNCTION IF EXISTS ledger_accounts_guard();
