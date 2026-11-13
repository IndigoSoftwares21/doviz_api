-- KYC, provider-agnostic and reusable.
--
-- kyc_fields: each piece of identity data (BVN, birth date, address…) is its
-- own row, encrypted by the app with its own data key (AES-256-GCM, wrapped by
-- a versioned master key, bound to user + field + row). Rows are never edited:
-- a change adds a new row and marks the old one superseded, so history is
-- kept and the current value of any field can be reused anywhere. `field_key`
-- is data, so a new kind of field (e.g. NIN) needs no migration.
--
-- kyc_records: verification attempts. Each links (kyc_record_fields) to the
-- exact field rows it checked, so we can always say what was verified, when,
-- and by whom. users.active_kyc_record_id is the verification in force.
CREATE TABLE kyc_fields (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    field_key VARCHAR(32) NOT NULL,
    key_version SMALLINT NOT NULL,
    wrapped_key TEXT NOT NULL,
    value_enc TEXT NOT NULL,
    -- Keyed HMAC of an identifier's value (BVN, NIN) — lookups without decrypting.
    lookup_index CHAR(64),
    -- Safe-to-show hint, e.g. a BVN's last 4 digits. Never the value.
    display_hint VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_at TIMESTAMPTZ,
    CONSTRAINT kyc_fields_key_check CHECK (field_key ~ '^[a-z][a-z0-9_]{1,31}$'),
    CONSTRAINT kyc_fields_key_version_check CHECK (key_version > 0),
    CONSTRAINT kyc_fields_lookup_check CHECK (lookup_index IS NULL OR lookup_index ~ '^[0-9a-f]{64}$')
);

-- The current value of each field, per user.
CREATE UNIQUE INDEX kyc_fields_current ON kyc_fields (user_id, field_key) WHERE superseded_at IS NULL;
CREATE INDEX kyc_fields_user_idx ON kyc_fields (user_id, field_key, created_at DESC);

-- Field rows never change, except being superseded once (and re-wrapping the
-- data key on master-key rotation: key_version + wrapped_key together).
CREATE FUNCTION kyc_fields_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.user_id <> OLD.user_id OR NEW.field_key <> OLD.field_key OR NEW.value_enc <> OLD.value_enc
        OR NEW.lookup_index IS DISTINCT FROM OLD.lookup_index OR NEW.display_hint IS DISTINCT FROM OLD.display_hint
        OR NEW.created_at <> OLD.created_at
        OR (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at) THEN
        RAISE EXCEPTION 'kyc_fields are append-only';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kyc_fields_guard BEFORE UPDATE ON kyc_fields FOR EACH ROW EXECUTE FUNCTION kyc_fields_guard();

CREATE TABLE kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL,
    level VARCHAR(24) NOT NULL,
    rejection_reason VARCHAR(255),
    -- What decided it (e.g. the verifier that matched the BVN), its reference
    -- for the check, and the evidence: per-field match results and scores
    -- only — never a value or an image.
    decided_by VARCHAR(32),
    provider_reference VARCHAR(128),
    evidence JSONB,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT kyc_records_status_check CHECK (status IN ('pending', 'verified', 'rejected', 'superseded')),
    CONSTRAINT kyc_records_level_check CHECK (level ~ '^[a-z][a-z0-9_]{1,23}$'),
    CONSTRAINT kyc_records_decided_check CHECK (
        (status = 'pending' AND decided_at IS NULL AND decided_by IS NULL)
        OR (status <> 'pending' AND decided_at IS NOT NULL AND decided_by IS NOT NULL)
    ),
    CONSTRAINT kyc_records_rejected_check CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL),
    CONSTRAINT kyc_records_superseded_check CHECK ((status = 'superseded') = (superseded_at IS NOT NULL))
);

CREATE INDEX kyc_records_user_idx ON kyc_records (user_id, submitted_at DESC);
-- At most one attempt in review, and one verification in force, per user.
CREATE UNIQUE INDEX kyc_records_one_pending ON kyc_records (user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX kyc_records_one_verified ON kyc_records (user_id) WHERE status = 'verified';

-- Status only moves pending → verified | rejected, verified → superseded.
CREATE FUNCTION kyc_records_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.user_id <> OLD.user_id OR NEW.level <> OLD.level OR NEW.submitted_at <> OLD.submitted_at THEN
        RAISE EXCEPTION 'kyc_records are append-only';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
        (OLD.status = 'pending' AND NEW.status IN ('verified', 'rejected'))
        OR (OLD.status = 'verified' AND NEW.status = 'superseded')
    ) THEN
        RAISE EXCEPTION 'kyc_records status cannot go from % to %', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kyc_records_guard BEFORE UPDATE ON kyc_records FOR EACH ROW EXECUTE FUNCTION kyc_records_guard();

-- Exactly which field values an attempt checked. Insert-only.
CREATE TABLE kyc_record_fields (
    record_id UUID NOT NULL REFERENCES kyc_records (id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES kyc_fields (id) ON DELETE CASCADE,
    field_key VARCHAR(32) NOT NULL,
    PRIMARY KEY (record_id, field_key)
);

CREATE INDEX kyc_record_fields_field_idx ON kyc_record_fields (field_id);

CREATE FUNCTION kyc_record_fields_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'kyc_record_fields are insert-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kyc_record_fields_guard BEFORE UPDATE ON kyc_record_fields FOR EACH ROW EXECUTE FUNCTION kyc_record_fields_guard();

-- One identifier (BVN, NIN…) per Ziks user. Its owner may reuse it (re-verify,
-- upgrade); anyone else is refused. Released when the attempt holding it is
-- rejected, so typing someone else's BVN can't lock them out.
CREATE TABLE kyc_identifier_claims (
    field_key VARCHAR(32) NOT NULL,
    lookup_index CHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (field_key, lookup_index)
);

CREATE INDEX kyc_identifier_claims_user_idx ON kyc_identifier_claims (user_id);

ALTER TABLE users ADD COLUMN active_kyc_record_id UUID REFERENCES kyc_records (id) ON DELETE SET NULL;
