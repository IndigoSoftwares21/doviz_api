-- Part of the bill payments feature (provider-agnostic; Flutterwave first).
-- See BILL_PAYMENTS_PLAN.md. No table or column is named after a provider.

-- Money in any currency: exact to 2 decimals, extra decimals REJECTED (never
-- silently rounded). Same rule as naira_amount, with a currency-neutral name.
CREATE DOMAIN money_amount AS NUMERIC
    CHECK (VALUE IS NULL OR (scale(VALUE) <= 2 AND abs(VALUE) < 1000000000000000));

-- -----------------------------------------------------------------------------
-- Categories: a fixed list Doviz owns. The app groups billers by these.
-- -----------------------------------------------------------------------------
CREATE TABLE bill_categories (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_categories_code_format CHECK (code ~ '^[a-z]+(_[a-z]+)*$')
);

INSERT INTO bill_categories (code, name, sort_order) VALUES
    ('airtime', 'Airtime', 1),
    ('data', 'Data', 2),
    ('electricity', 'Electricity', 3),
    ('cable_tv', 'Cable TV', 4),
    ('internet', 'Internet', 5);

-- -----------------------------------------------------------------------------
-- Billers: real companies (MTN, Ikeja Electric, DStv) — ours, the same whichever
-- provider we use. Names and logos shown in the app come ONLY from here.
-- `match_keywords`: words that identify this biller in ANY provider's raw
-- names (whole-word, case-insensitive). The catalog sync uses them to suggest
-- links; adding a provider needs no code change, only keywords + a review.
-- -----------------------------------------------------------------------------
CREATE TABLE billers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(32) NOT NULL REFERENCES bill_categories (code) ON DELETE RESTRICT,
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(512),
    customer_id_label VARCHAR(64) NOT NULL,
    customer_id_pattern VARCHAR(255),
    requires_validation BOOLEAN NOT NULL DEFAULT false,
    match_keywords TEXT[] NOT NULL DEFAULT '{}',
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT billers_slug_unique UNIQUE (slug),
    CONSTRAINT billers_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX billers_category_idx ON billers (category_code) WHERE is_enabled;

INSERT INTO billers
    (category_code, slug, name, customer_id_label, customer_id_pattern, requires_validation, match_keywords, sort_order)
VALUES
    ('airtime', 'mtn-airtime', 'MTN', 'Phone number', '^0[789][01][0-9]{8}$', false, '{MTN}', 1),
    ('airtime', 'airtel-airtime', 'Airtel', 'Phone number', '^0[789][01][0-9]{8}$', false, '{AIRTEL}', 2),
    ('airtime', 'glo-airtime', 'Glo', 'Phone number', '^0[789][01][0-9]{8}$', false, '{GLO,GLOBACOM}', 3),
    ('airtime', '9mobile-airtime', '9mobile', 'Phone number', '^0[789][01][0-9]{8}$', false, '{9MOBILE,ETISALAT}', 4),
    ('data', 'mtn-data', 'MTN', 'Phone number', '^0[789][01][0-9]{8}$', false, '{MTN}', 1),
    ('data', 'airtel-data', 'Airtel', 'Phone number', '^0[789][01][0-9]{8}$', false, '{AIRTEL}', 2),
    ('data', 'glo-data', 'Glo', 'Phone number', '^0[789][01][0-9]{8}$', false, '{GLO,GLOBACOM}', 3),
    ('data', '9mobile-data', '9mobile', 'Phone number', '^0[789][01][0-9]{8}$', false, '{9MOBILE,ETISALAT}', 4),
    ('electricity', 'ikeja-electric', 'Ikeja Electric (IKEDC)', 'Meter number', '^[0-9]{6,20}$', true, '{IKEJA,IKEDC}', 1),
    ('electricity', 'eko-electric', 'Eko Electric (EKEDC)', 'Meter number', '^[0-9]{6,20}$', true, '{EKO,EKEDC}', 2),
    ('electricity', 'abuja-electric', 'Abuja Electric (AEDC)', 'Meter number', '^[0-9]{6,20}$', true, '{ABUJA,AEDC}', 3),
    ('electricity', 'ibadan-electric', 'Ibadan Electric (IBEDC)', 'Meter number', '^[0-9]{6,20}$', true, '{IBADAN,IBEDC}', 4),
    ('electricity', 'enugu-electric', 'Enugu Electric (EEDC)', 'Meter number', '^[0-9]{6,20}$', true, '{ENUGU,EEDC}', 5),
    ('electricity', 'port-harcourt-electric', 'Port Harcourt Electric (PHED)', 'Meter number', '^[0-9]{6,20}$', true, '{PORT HARCOURT,PHC,PHED,PHEDC}', 6),
    ('electricity', 'kano-electric', 'Kano Electric (KEDCO)', 'Meter number', '^[0-9]{6,20}$', true, '{KANO,KEDCO}', 7),
    ('electricity', 'kaduna-electric', 'Kaduna Electric (KAEDCO)', 'Meter number', '^[0-9]{6,20}$', true, '{KADUNA,KAEDCO}', 8),
    ('electricity', 'jos-electric', 'Jos Electric (JED)', 'Meter number', '^[0-9]{6,20}$', true, '{JOS,JED,JEDC}', 9),
    ('electricity', 'benin-electric', 'Benin Electric (BEDC)', 'Meter number', '^[0-9]{6,20}$', true, '{BENIN,BEDC}', 10),
    ('electricity', 'yola-electric', 'Yola Electric (YEDC)', 'Meter number', '^[0-9]{6,20}$', true, '{YOLA,YEDC}', 11),
    ('electricity', 'aba-power', 'Aba Power', 'Meter number', '^[0-9]{6,20}$', true, '{ABA POWER}', 12),
    ('cable_tv', 'dstv', 'DStv', 'Smartcard number', '^[0-9]{10,12}$', true, '{DSTV}', 1),
    ('cable_tv', 'gotv', 'GOtv', 'IUC number', '^[0-9]{10,12}$', true, '{GOTV}', 2),
    ('cable_tv', 'startimes', 'StarTimes', 'Smartcard number', '^[0-9]{10,12}$', true, '{STARTIMES,STAR TIMES}', 3),
    ('internet', 'smile', 'Smile', 'Account number', NULL, true, '{SMILE}', 1),
    ('internet', 'spectranet', 'Spectranet', 'Account number', NULL, true, '{SPECTRANET}', 2),
    ('internet', 'ipnx', 'ipNX', 'Account number', NULL, true, '{IPNX}', 3);

-- -----------------------------------------------------------------------------
-- Every biller a provider offers, raw, and how it links to ours. Rows are
-- never created by hand: the catalog sync records each provider biller and
-- SUGGESTS a link (`biller_id` + `match_reason`). A person then confirms or
-- ignores it. Only CONFIRMED links reach the app, so nothing a provider adds
-- or renames can show up unreviewed.
--   suggested — sync's guess (biller_id may be NULL: no confident match)
--   confirmed — reviewed; its products are listed under biller_id
--   ignored   — reviewed; never listed (tax, courier, dealer payments, ...)
-- `is_available` = seen in the provider's latest catalog.
-- -----------------------------------------------------------------------------
CREATE TABLE biller_provider_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biller_id UUID REFERENCES billers (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    provider_biller_ref VARCHAR(64) NOT NULL,
    provider_name VARCHAR(128) NOT NULL,
    provider_category VARCHAR(64),
    provider_customer_id_label VARCHAR(64),
    provider_logo_url VARCHAR(512),
    status VARCHAR(16) NOT NULL DEFAULT 'suggested',
    match_reason VARCHAR(255),
    is_available BOOLEAN NOT NULL DEFAULT true,
    reviewed_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT biller_provider_refs_env_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT biller_provider_refs_status_check CHECK (status IN ('suggested', 'confirmed', 'ignored')),
    CONSTRAINT biller_provider_refs_confirmed_has_biller CHECK (status <> 'confirmed' OR biller_id IS NOT NULL),
    CONSTRAINT biller_provider_refs_reviewed_check CHECK ((status = 'suggested') = (reviewed_at IS NULL)),
    CONSTRAINT biller_provider_refs_ref_unique UNIQUE (provider, environment, provider_biller_ref)
);

CREATE INDEX biller_provider_refs_listing_idx
    ON biller_provider_refs (biller_id, provider, environment) WHERE status = 'confirmed' AND is_available;

-- -----------------------------------------------------------------------------
-- Products differ per provider (bundle sizes, validity, prices), so each
-- provider has its own rows, under the provider biller they came from. The
-- app lists only the ACTIVE provider's products of CONFIRMED links; old
-- payments keep pointing at the rows they were bought from.
--   fixed — one price (a data bundle, a cable plan)
--   range — any amount between min and max (airtime, electricity)
-- Names: `provider_name` is the provider's raw text (audit), `name` is the
-- sync's cleaned version, `display_name` is a manual override the sync never
-- touches. The app shows coalesce(display_name, name).
-- Flags: `is_available` is sync-managed (in the provider's latest catalog);
-- `is_enabled` is ours (the sync only sets it on first insert, e.g. off for a
-- duplicate). Listed only when both are true.
-- `provider_product_ref` is opaque: only that provider's code reads it.
-- -----------------------------------------------------------------------------
CREATE TABLE bill_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biller_provider_ref_id UUID NOT NULL REFERENCES biller_provider_refs (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    provider_product_ref VARCHAR(128) NOT NULL,
    provider_name VARCHAR(128) NOT NULL,
    name VARCHAR(128) NOT NULL,
    display_name VARCHAR(128),
    amount_type VARCHAR(8) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    price money_amount,
    min_amount money_amount,
    max_amount money_amount,
    service_fee money_amount NOT NULL DEFAULT 0.00,
    validity_days SMALLINT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_products_env_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT bill_products_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT bill_products_amount_type_check CHECK (amount_type IN ('fixed', 'range')),
    CONSTRAINT bill_products_fixed_check CHECK (
        amount_type <> 'fixed' OR (price IS NOT NULL AND price > 0)
    ),
    CONSTRAINT bill_products_range_check CHECK (
        amount_type <> 'range'
        OR (min_amount IS NOT NULL AND max_amount IS NOT NULL AND min_amount > 0 AND min_amount <= max_amount)
    ),
    CONSTRAINT bill_products_fee_check CHECK (service_fee >= 0),
    CONSTRAINT bill_products_validity_check CHECK (validity_days IS NULL OR validity_days > 0),
    CONSTRAINT bill_products_ref_unique UNIQUE (provider, environment, provider_product_ref)
);

CREATE INDEX bill_products_listing_idx
    ON bill_products (biller_provider_ref_id) WHERE is_available AND is_enabled;

-- -----------------------------------------------------------------------------
-- Ledger vocabulary for bills.
--   bills_in_transit — per provider: user money held for bills not yet final
--   bill_revenue     — Doviz's margin on bills (service fee + provider commission)
-- -----------------------------------------------------------------------------
ALTER TABLE ledger_accounts
    DROP CONSTRAINT ledger_accounts_kind_check,
    DROP CONSTRAINT ledger_accounts_provider_check,
    ADD CONSTRAINT ledger_accounts_kind_check CHECK (
        kind IN ('user_available', 'provider_clearing', 'payouts_in_transit', 'markup_revenue',
                 'bills_in_transit', 'bill_revenue')
    ),
    ADD CONSTRAINT ledger_accounts_provider_check CHECK (
        (kind IN ('provider_clearing', 'payouts_in_transit', 'bills_in_transit')) = (provider IS NOT NULL)
    );

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal',
                 'bill_hold', 'bill_settle', 'bill_reversal')
    );

-- -----------------------------------------------------------------------------
-- Bill payments. The money is HELD (user → bills_in_transit) in the same DB
-- transaction that inserts the row, BEFORE the provider is called. `id` is
-- sent to the provider as our reference, so a timed-out request can be looked
-- up. completed = settled; failed = refunded. Both carry the final ledger link.
--   pending    — held; sent (or about to be sent) to the provider
--   processing — outcome unknown (timeout / unclear error); reconciler decides
-- `total` = `amount` + `service_fee` — what the user is charged.
-- -----------------------------------------------------------------------------
CREATE TABLE bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES bill_products (id) ON DELETE RESTRICT,
    biller_id UUID NOT NULL REFERENCES billers (id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL,
    provider_reference VARCHAR(128),
    idempotency_key VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(150),
    currency VARCHAR(3) NOT NULL,
    amount money_amount NOT NULL,
    service_fee money_amount NOT NULL DEFAULT 0.00,
    total money_amount NOT NULL,
    provider_cost money_amount,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    token VARCHAR(255),
    failure_reason VARCHAR(255),
    hold_ledger_transaction_id UUID NOT NULL REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    final_ledger_transaction_id UUID REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_payments_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT bill_payments_amount_check CHECK (
        amount > 0 AND service_fee >= 0 AND total = amount + service_fee
        AND (provider_cost IS NULL OR provider_cost >= 0)
    ),
    CONSTRAINT bill_payments_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT bill_payments_final_has_ledger CHECK (
        (status IN ('completed', 'failed')) = (final_ledger_transaction_id IS NOT NULL)
    ),
    CONSTRAINT bill_payments_idempotency_unique UNIQUE (user_id, idempotency_key),
    CONSTRAINT bill_payments_reference_unique UNIQUE (provider, provider_reference),
    CONSTRAINT bill_payments_hold_unique UNIQUE (hold_ledger_transaction_id),
    CONSTRAINT bill_payments_final_unique UNIQUE (final_ledger_transaction_id)
);

CREATE INDEX bill_payments_user_idx ON bill_payments (user_id, created_at DESC);
CREATE INDEX bill_payments_open_idx ON bill_payments (status, requested_at) WHERE status IN ('pending', 'processing');

CREATE FUNCTION bill_payments_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'failed') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'bill_payments: % is terminal and cannot become %', OLD.status, NEW.status;
    END IF;
    IF NEW.user_id <> OLD.user_id OR NEW.product_id <> OLD.product_id OR NEW.biller_id <> OLD.biller_id
        OR NEW.provider <> OLD.provider OR NEW.idempotency_key <> OLD.idempotency_key
        OR NEW.customer_id <> OLD.customer_id OR NEW.currency <> OLD.currency
        OR NEW.amount <> OLD.amount OR NEW.service_fee <> OLD.service_fee OR NEW.total <> OLD.total
        OR NEW.hold_ledger_transaction_id <> OLD.hold_ledger_transaction_id
        OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
        OR (OLD.provider_cost IS NOT NULL AND NEW.provider_cost IS DISTINCT FROM OLD.provider_cost)
        OR (OLD.token IS NOT NULL AND NEW.token IS DISTINCT FROM OLD.token)
        OR (OLD.final_ledger_transaction_id IS NOT NULL
            AND NEW.final_ledger_transaction_id IS DISTINCT FROM OLD.final_ledger_transaction_id) THEN
        RAISE EXCEPTION 'bill_payments: amounts, customer, provider and ledger links are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bill_payments_guard BEFORE UPDATE ON bill_payments
    FOR EACH ROW EXECUTE FUNCTION bill_payments_guard();
CREATE TRIGGER bill_payments_no_delete BEFORE DELETE ON bill_payments
    FOR EACH ROW EXECUTE FUNCTION doviz_block_delete();
