-- A default payout fee per provider and environment, for providers that can't
-- quote a fee before sending (Korapay). The quote reserves the HIGHER of this
-- and the highest real fee the provider charged us in the last 30 days; the
-- real fee is still charged at settlement and any unused reserve returned.
-- fee = fixed_fee + vat_percent% of it (₦50 + 7.5% = ₦53.75).
CREATE TABLE payout_fee_defaults (
    provider VARCHAR(32) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    fixed_fee naira_amount NOT NULL,
    vat_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, environment, currency),
    CONSTRAINT payout_fee_defaults_env_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT payout_fee_defaults_amount_check CHECK (fixed_fee >= 0 AND vat_percent >= 0 AND vat_percent <= 50),
    CONSTRAINT payout_fee_defaults_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

-- Korapay: ₦50 + 7.5% VAT live (₦53.75 seen on a live payout); ₦30 + VAT in sandbox (₦32.25 seen).
INSERT INTO payout_fee_defaults (provider, environment, fixed_fee, vat_percent) VALUES
    ('korapay', 'production', 50.00, 7.50),
    ('korapay', 'sandbox', 30.00, 7.50);
