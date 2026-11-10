-- Fails (by design) once bill ledger postings exist: the ledger is append-only.

DROP TABLE bill_payments;
DROP FUNCTION bill_payments_guard();
DROP TABLE bill_products;
DROP TABLE biller_provider_refs;
DROP TABLE billers;
DROP TABLE bill_categories;

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal')
    );

ALTER TABLE ledger_accounts
    DROP CONSTRAINT ledger_accounts_kind_check,
    DROP CONSTRAINT ledger_accounts_provider_check,
    ADD CONSTRAINT ledger_accounts_kind_check CHECK (
        kind IN ('user_available', 'provider_clearing', 'payouts_in_transit', 'markup_revenue')
    ),
    ADD CONSTRAINT ledger_accounts_provider_check CHECK (
        (kind IN ('provider_clearing', 'payouts_in_transit')) = (provider IS NOT NULL)
    );

DROP DOMAIN money_amount;
