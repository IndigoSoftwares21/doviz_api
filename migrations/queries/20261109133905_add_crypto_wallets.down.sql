-- Dev/test only. Never roll back a database holding real money.
DROP TABLE IF EXISTS crypto_wallets;
DROP FUNCTION IF EXISTS crypto_wallets_guard();
