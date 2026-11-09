-- Dev/test only. Never roll back a database holding real money.
DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS ledger_transactions;
DROP FUNCTION IF EXISTS ledger_entries_check_balanced();
DROP FUNCTION IF EXISTS ledger_entries_post();
