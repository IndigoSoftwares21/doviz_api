-- What the bill provider charges us per payment for this product, on top of the
-- amount (synced from its catalog; 0 when it states none). The user pays it:
-- total = amount + provider_fee + service_fee (service_fee stays ours to set).
ALTER TABLE bill_products
    ADD COLUMN provider_fee money_amount NOT NULL DEFAULT 0.00,
    ADD CONSTRAINT bill_products_provider_fee_check CHECK (provider_fee >= 0);
