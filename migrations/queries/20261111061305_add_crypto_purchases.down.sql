DROP TABLE crypto_stock_movements;
DROP TABLE crypto_purchases;
DROP FUNCTION crypto_purchases_guard();
DROP TABLE crypto_buy_rates;

ALTER TABLE crypto_provider_assets
    DROP CONSTRAINT crypto_provider_assets_send_check,
    DROP COLUMN memo_required,
    DROP COLUMN send_precision,
    DROP COLUMN send_fee,
    DROP COLUMN min_send,
    DROP COLUMN can_send;

ALTER TABLE crypto_assets DROP COLUMN is_buy_enabled;

DELETE FROM provider_settings WHERE service = 'crypto_sends';
ALTER TABLE provider_settings
    DROP CONSTRAINT provider_settings_service_check,
    ADD CONSTRAINT provider_settings_service_check CHECK (service IN ('payouts'));

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal',
                 'bill_hold', 'bill_settle', 'bill_reversal', 'naira_deposit')
    );

ALTER TABLE ledger_accounts
    DROP CONSTRAINT ledger_accounts_kind_check,
    DROP CONSTRAINT ledger_accounts_provider_check,
    ADD CONSTRAINT ledger_accounts_kind_check CHECK (
        kind IN ('user_available', 'provider_clearing', 'payouts_in_transit', 'markup_revenue',
                 'bills_in_transit', 'bill_revenue', 'provider_fees')
    ),
    ADD CONSTRAINT ledger_accounts_provider_check CHECK (
        (kind IN ('provider_clearing', 'payouts_in_transit', 'bills_in_transit', 'provider_fees')) = (provider IS NOT NULL)
    );
