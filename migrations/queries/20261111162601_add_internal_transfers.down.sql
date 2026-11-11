DROP TABLE internal_transfers;
DROP FUNCTION internal_transfers_guard();
DROP TABLE transfer_limits;

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_type_check,
    ADD CONSTRAINT ledger_transactions_type_check CHECK (
        type IN ('crypto_deposit', 'withdrawal_hold', 'withdrawal_settle', 'withdrawal_reversal',
                 'bill_hold', 'bill_settle', 'bill_reversal', 'naira_deposit',
                 'crypto_purchase_hold', 'crypto_purchase_settle', 'crypto_purchase_reversal')
    );
