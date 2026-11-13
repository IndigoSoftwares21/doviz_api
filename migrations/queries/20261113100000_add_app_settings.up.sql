-- Feature switches the app follows without a release (read by the API).
--   kyc_level: which checks identity verification runs — 'bvn' (BVN details +
--   verified phone) or 'bvn_selfie' (plus the selfie matched to the BVN photo).
CREATE TABLE app_settings (
    key VARCHAR(64) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_settings_key_check CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$')
);

INSERT INTO app_settings (key, value) VALUES ('kyc_level', 'bvn');
