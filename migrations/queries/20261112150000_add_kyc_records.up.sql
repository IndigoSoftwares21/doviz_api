-- KYC history. Every submission is its own row and is never edited: its
-- personal fields are fixed at insert (trigger below) and its status only
-- moves forward. users.active_kyc_record_id points at the verified record in
-- force, so anything that relied on a verification can name exactly which one.
--
-- Every personal field is encrypted by the app (AES-256-GCM, a per-record data
-- key wrapped by a versioned master key): this table never holds a readable
-- BVN, birth date, gender, address or legal name. `bvn_index` is a keyed HMAC
-- of the BVN (lookups without decrypting); `bvn_last4` is for masked display.
CREATE TABLE kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL,
    level VARCHAR(24) NOT NULL,
    bvn_index CHAR(64) NOT NULL,
    bvn_last4 CHAR(4) NOT NULL,
    key_version SMALLINT NOT NULL,
    wrapped_key TEXT NOT NULL,
    bvn_enc TEXT NOT NULL,
    first_name_enc TEXT NOT NULL,
    middle_name_enc TEXT,
    last_name_enc TEXT NOT NULL,
    date_of_birth_enc TEXT NOT NULL,
    gender_enc TEXT NOT NULL,
    address_enc TEXT NOT NULL,
    rejection_reason VARCHAR(255),
    -- Who decided it (e.g. the account provider that matched the BVN).
    decided_by VARCHAR(32),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT kyc_records_status_check CHECK (status IN ('pending', 'verified', 'rejected', 'superseded')),
    CONSTRAINT kyc_records_level_check CHECK (level IN ('bvn', 'bvn_liveness')),
    CONSTRAINT kyc_records_bvn_index_check CHECK (bvn_index ~ '^[0-9a-f]{64}$'),
    CONSTRAINT kyc_records_bvn_last4_check CHECK (bvn_last4 ~ '^[0-9]{4}$'),
    CONSTRAINT kyc_records_key_version_check CHECK (key_version > 0),
    CONSTRAINT kyc_records_decided_check CHECK (
        (status = 'pending' AND decided_at IS NULL AND decided_by IS NULL)
        OR (status <> 'pending' AND decided_at IS NOT NULL AND decided_by IS NOT NULL)
    ),
    CONSTRAINT kyc_records_rejected_check CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL),
    CONSTRAINT kyc_records_superseded_check CHECK ((status = 'superseded') = (superseded_at IS NOT NULL))
);

-- A user's history, newest first.
CREATE INDEX kyc_records_user_idx ON kyc_records (user_id, submitted_at DESC);
-- At most one submission in review, and one verification in force, per user.
CREATE UNIQUE INDEX kyc_records_one_pending ON kyc_records (user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX kyc_records_one_verified ON kyc_records (user_id) WHERE status = 'verified';

-- Records are append-only: identity and encrypted fields never change, and
-- status only moves pending → verified | rejected, verified → superseded.
-- (key_version + wrapped_key may change together: re-wrapping on key rotation.)
CREATE FUNCTION kyc_records_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.user_id <> OLD.user_id OR NEW.level <> OLD.level OR NEW.bvn_index <> OLD.bvn_index
        OR NEW.bvn_last4 <> OLD.bvn_last4 OR NEW.bvn_enc <> OLD.bvn_enc
        OR NEW.first_name_enc <> OLD.first_name_enc OR NEW.middle_name_enc IS DISTINCT FROM OLD.middle_name_enc
        OR NEW.last_name_enc <> OLD.last_name_enc OR NEW.date_of_birth_enc <> OLD.date_of_birth_enc
        OR NEW.gender_enc <> OLD.gender_enc OR NEW.address_enc <> OLD.address_enc
        OR NEW.submitted_at <> OLD.submitted_at THEN
        RAISE EXCEPTION 'kyc_records are append-only: identity fields cannot change';
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

CREATE TRIGGER kyc_records_guard BEFORE UPDATE ON kyc_records
    FOR EACH ROW EXECUTE FUNCTION kyc_records_guard();

-- One BVN, one Ziks user. A user may submit their own BVN again (re-verify,
-- upgrade); anyone else is refused. A claim is released when the submission
-- holding it is rejected, so typing someone else's BVN can't lock them out.
CREATE TABLE kyc_bvn_claims (
    bvn_index CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX kyc_bvn_claims_user_idx ON kyc_bvn_claims (user_id);

-- The verification in force for this user (always a `verified` record of theirs).
ALTER TABLE users ADD COLUMN active_kyc_record_id UUID REFERENCES kyc_records (id) ON DELETE SET NULL;
