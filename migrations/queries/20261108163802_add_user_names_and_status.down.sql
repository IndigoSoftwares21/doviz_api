ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_name_complete,
    DROP CONSTRAINT IF EXISTS users_status_check,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS name_updated_at,
    DROP COLUMN IF EXISTS last_name,
    DROP COLUMN IF EXISTS middle_name,
    DROP COLUMN IF EXISTS first_name;
