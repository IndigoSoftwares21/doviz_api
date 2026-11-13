ALTER TABLE users DROP COLUMN IF EXISTS active_kyc_record_id;
DROP TABLE IF EXISTS kyc_bvn_claims;
DROP TRIGGER IF EXISTS kyc_records_guard ON kyc_records;
DROP FUNCTION IF EXISTS kyc_records_guard();
DROP TABLE IF EXISTS kyc_records;
