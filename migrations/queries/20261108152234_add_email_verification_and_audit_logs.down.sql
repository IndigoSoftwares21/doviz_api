DROP TABLE IF EXISTS audit_logs;
DROP FUNCTION IF EXISTS audit_logs_block_mutation();
DROP TABLE IF EXISTS email_verifications;
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_email_verified,
    DROP CONSTRAINT IF EXISTS users_email_lowercase,
    DROP CONSTRAINT IF EXISTS users_email_unique,
    DROP COLUMN IF EXISTS email_verified_at,
    DROP COLUMN IF EXISTS email;
