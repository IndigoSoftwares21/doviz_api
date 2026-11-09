ALTER TABLE payout_banks
    DROP CONSTRAINT payout_banks_code_format,
    DROP CONSTRAINT payout_banks_slug_format,
    DROP CONSTRAINT payout_banks_slug_unique;

-- Restore a non-null stand-in code for banks without a real one.
UPDATE payout_banks SET code = 'B' || left(md5(slug), 15) WHERE code IS NULL;

ALTER TABLE payout_banks ALTER COLUMN code SET NOT NULL;
ALTER TABLE payout_banks DROP COLUMN slug;
