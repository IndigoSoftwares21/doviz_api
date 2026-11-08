-- Devices each user has signed in on. A device becomes trusted after an SMS
-- login; trusted devices can then unlock with the PIN or biometrics.
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    device_id VARCHAR(128) NOT NULL,
    device_name VARCHAR(100),
    platform VARCHAR(16),
    last_ip VARCHAR(45),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    trusted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_devices_user_device_unique UNIQUE (user_id, device_id),
    CONSTRAINT user_devices_platform_check CHECK (platform IN ('ios', 'android', 'web'))
);

-- Sessions now belong to a device. Refresh tokens move to their own table
-- so they can rotate on every use, with reuse detection.
ALTER TABLE auth_sessions
    ADD COLUMN user_device_id UUID REFERENCES user_devices (id) ON DELETE CASCADE,
    ADD COLUMN revoked_reason VARCHAR(32),
    DROP CONSTRAINT auth_sessions_refresh_token_hash_unique,
    DROP COLUMN refresh_token_hash;

-- At most one live session per device.
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_one_live_per_device
    ON auth_sessions (user_device_id)
    WHERE revoked_at IS NULL;

-- Every refresh token ever issued (SHA-256 only). A token with rotated_at
-- set has been used; presenting it again means it was stolen.
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES auth_sessions (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    rotated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT auth_refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS auth_refresh_tokens_session_id_idx ON auth_refresh_tokens (session_id);

-- A biometric signature made to unlock the app must never approve anything
-- else (and vice versa).
ALTER TABLE biometric_challenges
    ADD COLUMN purpose VARCHAR(16) NOT NULL DEFAULT 'verification',
    ADD CONSTRAINT biometric_challenges_purpose_check CHECK (purpose IN ('verification', 'login'));
