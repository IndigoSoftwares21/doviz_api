-- Back to set-rate pricing only.
CREATE OR REPLACE FUNCTION crypto_purchases_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'failed') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'crypto_purchases: % is terminal and cannot become %', OLD.status, NEW.status;
    END IF;
    IF NEW.user_id <> OLD.user_id OR NEW.asset_id <> OLD.asset_id OR NEW.provider <> OLD.provider
        OR NEW.environment <> OLD.environment OR NEW.provider_asset_id <> OLD.provider_asset_id
        OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.address <> OLD.address
        OR NEW.memo IS DISTINCT FROM OLD.memo OR NEW.crypto_amount <> OLD.crypto_amount
        OR NEW.network_fee <> OLD.network_fee OR NEW.rate_id <> OLD.rate_id OR NEW.unit_price <> OLD.unit_price
        OR NEW.currency <> OLD.currency OR NEW.naira_amount <> OLD.naira_amount OR NEW.naira_fee <> OLD.naira_fee
        OR NEW.total_naira <> OLD.total_naira OR NEW.hold_ledger_transaction_id <> OLD.hold_ledger_transaction_id
        OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
        OR (OLD.final_ledger_transaction_id IS NOT NULL
            AND NEW.final_ledger_transaction_id IS DISTINCT FROM OLD.final_ledger_transaction_id) THEN
        RAISE EXCEPTION 'crypto_purchases: amounts, destination, price, provider and ledger links are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE crypto_purchases
    DROP CONSTRAINT crypto_purchases_markup_check,
    DROP CONSTRAINT crypto_purchases_market_price_check,
    DROP CONSTRAINT crypto_purchases_price_source_check,
    DROP COLUMN markup_percent,
    DROP COLUMN market_price_usdt,
    DROP COLUMN price_source;

DROP TABLE crypto_buy_markups;
