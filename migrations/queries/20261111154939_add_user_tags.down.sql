DROP TABLE user_tag_history;

ALTER TABLE users
    DROP CONSTRAINT users_tag_format,
    DROP CONSTRAINT users_tag_unique,
    DROP COLUMN tag_changed_at,
    DROP COLUMN tag;
