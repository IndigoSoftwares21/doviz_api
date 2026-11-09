-- Dev/test only. Never roll back a database holding real money.
DROP TABLE IF EXISTS conversion_markups;
DROP TABLE IF EXISTS crypto_provider_assets;
DROP TABLE IF EXISTS crypto_assets;
DROP FUNCTION IF EXISTS doviz_block_mutation();
DROP FUNCTION IF EXISTS doviz_block_delete();
DROP DOMAIN IF EXISTS naira_amount;
