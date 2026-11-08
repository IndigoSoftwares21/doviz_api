ALTER TABLE biometric_challenges
    DROP CONSTRAINT IF EXISTS biometric_challenges_purpose_check,
    DROP COLUMN IF EXISTS purpose;
DROP TABLE IF EXISTS auth_refresh_tokens;
DROP INDEX IF EXISTS auth_sessions_one_live_per_device;
-- Old sessions can't be restored to the previous shape; revoke them.
UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now());
ALTER TABLE auth_sessions
    ADD COLUMN refresh_token_hash VARCHAR(64),
    DROP COLUMN IF EXISTS revoked_reason,
    DROP COLUMN IF EXISTS user_device_id;
UPDATE auth_sessions SET refresh_token_hash = md5(id::text) || md5(id::text) WHERE refresh_token_hash IS NULL;
ALTER TABLE auth_sessions
    ALTER COLUMN refresh_token_hash SET NOT NULL,
    ADD CONSTRAINT auth_sessions_refresh_token_hash_unique UNIQUE (refresh_token_hash);
DROP TABLE IF EXISTS user_devices;
