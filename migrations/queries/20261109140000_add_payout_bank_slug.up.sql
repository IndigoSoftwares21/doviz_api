-- Banks get a provider-neutral identity (`slug`) and `code` becomes what the
-- name says: a real CBN/NIP code, or NULL until a provider supplies one.
-- Breet has no CBN codes, so the earlier "B<sha1(slug)>" stand-ins are cleared.

ALTER TABLE payout_banks ADD COLUMN slug VARCHAR(64);

UPDATE payout_banks
SET slug = left(trim(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), 64);

ALTER TABLE payout_banks ALTER COLUMN code DROP NOT NULL;

UPDATE payout_banks SET code = NULL WHERE code ~ '^B[0-9a-f]{15}$';

ALTER TABLE payout_banks
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT payout_banks_slug_unique UNIQUE (slug),
    ADD CONSTRAINT payout_banks_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    -- 3-digit CBN bank code or 5/6-digit NIP institution code.
    ADD CONSTRAINT payout_banks_code_format CHECK (code IS NULL OR code ~ '^[0-9]{3,6}$');

COMMENT ON COLUMN payout_banks.slug IS 'Provider-neutral bank identity (lowercase-hyphenated); sync upserts on it.';
COMMENT ON COLUMN payout_banks.code IS 'Real CBN/NIP code when a provider supplies one; NULL otherwise.';
