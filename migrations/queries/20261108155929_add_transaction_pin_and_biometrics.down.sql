DROP TABLE IF EXISTS biometric_challenges;
DROP TABLE IF EXISTS biometric_keys;
DROP TABLE IF EXISTS transaction_pins;
DELETE FROM phone_otps WHERE purpose = 'pin_reset';
ALTER TABLE phone_otps DROP CONSTRAINT phone_otps_purpose_check;
ALTER TABLE phone_otps
    ADD CONSTRAINT phone_otps_purpose_check CHECK (purpose IN ('login'));
