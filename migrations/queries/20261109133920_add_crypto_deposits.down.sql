-- Dev/test only. Never roll back a database holding real money.
DROP TABLE IF EXISTS crypto_deposits;
DROP FUNCTION IF EXISTS crypto_deposits_guard();
