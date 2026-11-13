ALTER TABLE users DROP COLUMN IF EXISTS active_kyc_record_id;
DROP TABLE IF EXISTS kyc_identifier_claims;
DROP TABLE IF EXISTS kyc_record_fields;
DROP FUNCTION IF EXISTS kyc_record_fields_guard();
DROP TABLE IF EXISTS kyc_records;
DROP FUNCTION IF EXISTS kyc_records_guard();
DROP TABLE IF EXISTS kyc_fields;
DROP FUNCTION IF EXISTS kyc_fields_guard();
