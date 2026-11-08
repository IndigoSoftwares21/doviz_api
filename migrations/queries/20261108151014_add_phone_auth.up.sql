-- Phone-number OTP authentication.
-- gen_random_uuid() is built into Postgres 13+ (docker image is 15).

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(16) NOT NULL,
    phone_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_phone_number_unique UNIQUE (phone_number),
    CONSTRAINT users_phone_number_e164 CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$')
);

-- The OTP itself is never stored: code_hash is HMAC-SHA256(OTP_PEPPER, phone:code).
CREATE TABLE IF NOT EXISTS phone_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(16) NOT NULL,
    purpose VARCHAR(32) NOT NULL DEFAULT 'login',
    code_hash VARCHAR(64) NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    max_attempts SMALLINT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    request_ip VARCHAR(45),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT phone_otps_purpose_check CHECK (purpose IN ('login')),
    CONSTRAINT phone_otps_attempts_check CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- At most one live (unconsumed, unrevoked) OTP per phone + purpose.
CREATE UNIQUE INDEX IF NOT EXISTS phone_otps_one_live_per_phone
    ON phone_otps (phone_number, purpose)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;

-- Resend cooldown / hourly request-limit lookups.
CREATE INDEX IF NOT EXISTS phone_otps_phone_created_at_idx
    ON phone_otps (phone_number, created_at DESC);

-- Refresh tokens are stored as SHA-256 hashes only.
CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT auth_sessions_refresh_token_hash_unique UNIQUE (refresh_token_hash)
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
