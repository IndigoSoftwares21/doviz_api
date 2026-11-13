-- Which flow "Add money" uses, switchable without an app release:
--   squad   → account number: verify identity once, get a personal account number
--   korapay → bank transfer: a one-time account per top-up (the original flow)
ALTER TABLE provider_settings
    DROP CONSTRAINT provider_settings_service_check,
    ADD CONSTRAINT provider_settings_service_check CHECK (service IN ('payouts', 'crypto_sends', 'naira_funding'));

INSERT INTO provider_settings (service, active_provider) VALUES ('naira_funding', 'squad');
