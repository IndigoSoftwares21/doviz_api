DELETE FROM provider_settings WHERE service = 'naira_funding';
ALTER TABLE provider_settings
    DROP CONSTRAINT provider_settings_service_check,
    ADD CONSTRAINT provider_settings_service_check CHECK (service IN ('payouts', 'crypto_sends'));
