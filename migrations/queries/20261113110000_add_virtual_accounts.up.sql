-- Each verified user's personal account number: money sent to it from any
-- bank is credited to their Ziks balance. Issued by a provider (Squad first)
-- from the user's verified KYC; `kyc_record_id` says which verification it
-- was opened on. `customer_ref` is OUR opaque reference for the user at the
-- provider (never the user id itself).
CREATE TABLE virtual_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    kyc_record_id UUID NOT NULL REFERENCES kyc_records (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    customer_ref VARCHAR(64) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    bank_code VARCHAR(16),
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT virtual_accounts_status_check CHECK (status IN ('active', 'closed')),
    CONSTRAINT virtual_accounts_env_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT virtual_accounts_number_check CHECK (account_number ~ '^[0-9]{10}$')
);

-- One open account per user per provider/environment; an account number belongs to one user.
CREATE UNIQUE INDEX virtual_accounts_one_active ON virtual_accounts (user_id, provider, environment) WHERE status = 'active';
CREATE UNIQUE INDEX virtual_accounts_number_unique ON virtual_accounts (provider, environment, account_number);
CREATE UNIQUE INDEX virtual_accounts_customer_ref_unique ON virtual_accounts (provider, environment, customer_ref);
