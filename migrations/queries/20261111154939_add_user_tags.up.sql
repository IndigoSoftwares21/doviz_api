-- Ziktags: a user's public @handle, used to receive transfers. A payments
-- identifier, so the database is the source of truth for format and
-- uniqueness (stored lowercase).
ALTER TABLE users
    ADD COLUMN tag VARCHAR(20),
    ADD COLUMN tag_changed_at TIMESTAMPTZ,
    ADD CONSTRAINT users_tag_unique UNIQUE (tag),
    ADD CONSTRAINT users_tag_format CHECK (tag IS NULL OR tag ~ '^[a-z][a-z0-9_]{2,19}$');

-- A tag given up by its owner is held for them (held_until) so nobody else
-- can take it and receive money meant for them. Append-only.
CREATE TABLE user_tag_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    tag VARCHAR(20) NOT NULL,
    released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    held_until TIMESTAMPTZ NOT NULL,
    CONSTRAINT user_tag_history_hold_check CHECK (held_until > released_at)
);

CREATE INDEX user_tag_history_tag_idx ON user_tag_history (tag, held_until DESC);

CREATE TRIGGER user_tag_history_append_only
    BEFORE UPDATE OR DELETE ON user_tag_history
    FOR EACH ROW EXECUTE FUNCTION doviz_block_mutation();
