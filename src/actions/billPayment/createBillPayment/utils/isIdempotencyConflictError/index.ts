import { DatabaseError } from "pg";

/** Two identical requests raced: the second insert hit UNIQUE (user_id, idempotency_key). */
const isIdempotencyConflictError = ({ error }: { error: unknown }) =>
    error instanceof DatabaseError && error.code === "23505" && error.constraint === "bill_payments_idempotency_unique";

export default isIdempotencyConflictError;
