-- Fails (by design) once naira deposit ledger postings exist: the ledger is append-only.

DROP TABLE naira_deposits;
DROP FUNCTION naira_deposits_guard();

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal',
                 'bill_hold', 'bill_settle', 'bill_reversal')
    );

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
