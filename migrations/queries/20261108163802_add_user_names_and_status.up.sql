-- Legal name, as on the user's ID (KYC will match against it), and an
-- account status support can use to freeze an account.
ALTER TABLE users
    ADD COLUMN first_name VARCHAR(50),
    ADD COLUMN middle_name VARCHAR(50),
    ADD COLUMN last_name VARCHAR(50),
    ADD COLUMN name_updated_at TIMESTAMPTZ,
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active',
    ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'closed')),
    ADD CONSTRAINT users_name_complete CHECK ((first_name IS NULL) = (last_name IS NULL));
