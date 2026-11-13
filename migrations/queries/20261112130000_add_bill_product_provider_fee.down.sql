ALTER TABLE bill_products
    DROP CONSTRAINT IF EXISTS bill_products_provider_fee_check,
    DROP COLUMN IF EXISTS provider_fee;
