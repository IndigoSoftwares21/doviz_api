-- Moving deposited money from a user's own provider wallet into our pooled
-- (master) wallet — the one float behind every Ziks balance, which pays all
-- withdrawals. Only for providers that leave deposits in per-user wallets
-- (Fossapay). Never touches user balances (they were credited already).
-- `reference` is fixed per deposit, so a retry can't move the money twice.
CREATE TABLE account_sweeps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    deposit_reference VARCHAR(128) NOT NULL,
    from_account VARCHAR(20) NOT NULL,
    amount money_amount NOT NULL,
    reference VARCHAR(36) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT account_sweeps_status_check CHECK (status IN ('pending', 'completed', 'failed')),
    CONSTRAINT account_sweeps_amount_check CHECK (amount > 0),
    CONSTRAINT account_sweeps_deposit_unique UNIQUE (provider, deposit_reference),
    CONSTRAINT account_sweeps_reference_unique UNIQUE (provider, reference)
);

CREATE INDEX account_sweeps_pending_idx ON account_sweeps (status, updated_at) WHERE status = 'pending';
