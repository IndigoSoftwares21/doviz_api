-- SMS codes can now also authorise a PIN reset.
ALTER TABLE phone_otps DROP CONSTRAINT phone_otps_purpose_check;
ALTER TABLE phone_otps
    ADD CONSTRAINT phone_otps_purpose_check CHECK (purpose IN ('login', 'pin_reset'));

-- Kept off `users` so PIN material can never leak through a user query.
-- pin_hash = bcrypt(HMAC-SHA256(PIN_PEPPER, user_id:pin)).
CREATE TABLE IF NOT EXISTS transaction_pins (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    pin_hash VARCHAR(100) NOT NULL,
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT transaction_pins_failed_attempts_check CHECK (failed_attempts >= 0)
);

-- One device key per enrolled device. public_key is a base64 DER SPKI
-- ECDSA P-256 key generated in the Secure Enclave / Android Keystore.
CREATE TABLE IF NOT EXISTS biometric_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    device_id VARCHAR(128) NOT NULL,
    device_name VARCHAR(100),
    public_key TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS biometric_keys_one_active_per_device
    ON biometric_keys (user_id, device_id)
    WHERE revoked_at IS NULL;

-- Single-use, short-lived nonces the device signs after a biometric prompt.
CREATE TABLE IF NOT EXISTS biometric_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    biometric_key_id UUID NOT NULL REFERENCES biometric_keys (id) ON DELETE CASCADE,
    challenge VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS biometric_challenges_user_id_idx ON biometric_challenges (user_id);
