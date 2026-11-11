import { DatabaseError } from "pg";

/** Two identical sends raced: the second insert hit UNIQUE (sender_id, idempotency_key). */
const isIdempotencyConflictError = ({ error }: { error: unknown }) =>
    error instanceof DatabaseError && error.code === "23505" && error.constraint === "internal_transfers_idempotency_unique";

export default isIdempotencyConflictError;
