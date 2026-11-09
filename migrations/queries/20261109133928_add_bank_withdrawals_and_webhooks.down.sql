-- Dev/test only. Never roll back a database holding real money.
DROP TABLE IF EXISTS provider_webhook_events;
DROP TABLE IF EXISTS bank_withdrawals;
DROP FUNCTION IF EXISTS bank_withdrawals_guard();
