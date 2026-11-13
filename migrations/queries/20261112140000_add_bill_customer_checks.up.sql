-- The last SUCCESSFUL provider check of a customer number (meter, smartcard)
-- for a product. Flutterwave refuses a re-check of the same meter for ~5-15s
-- after a success, so a payment made right after a successful check reuses it
-- instead of asking again. Failures are never stored.
CREATE TABLE bill_customer_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES bill_products (id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(150),
    address TEXT,
    min_amount money_amount,
    max_amount money_amount,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_customer_checks_unique UNIQUE (product_id, customer_id)
);
