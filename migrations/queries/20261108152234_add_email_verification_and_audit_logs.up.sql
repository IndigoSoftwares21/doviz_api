-- Email is only written to users once verified, so an unverified address can
-- never block its real owner from claiming it.
ALTER TABLE users
    ADD COLUMN email VARCHAR(254),
    ADD COLUMN email_verified_at TIMESTAMPTZ;

ALTER TABLE users
    ADD CONSTRAINT users_email_unique UNIQUE (email),
    ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
    ADD CONSTRAINT users_email_verified CHECK ((email IS NULL) = (email_verified_at IS NULL));

-- Same model as phone_otps: code_hash is HMAC-SHA256(OTP_PEPPER, subject:code).
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    max_attempts SMALLINT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    request_ip VARCHAR(45),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT email_verifications_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT email_verifications_attempts_check CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- At most one live code per user.
CREATE UNIQUE INDEX IF NOT EXISTS email_verifications_one_live_per_user
    ON email_verifications (user_id)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS email_verifications_user_created_at_idx
    ON email_verifications (user_id, created_at DESC);

-- Append-only audit trail. actor_id deliberately has no FK: audit history
-- must outlive the rows it describes. Never store OTPs, PINs or tokens here.
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type VARCHAR(16) NOT NULL,
    actor_id UUID,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_logs_actor_type_check CHECK (actor_type IN ('anonymous', 'user', 'admin', 'system'))
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_at_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

CREATE TRIGGER audit_logs_no_truncate
    BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();
