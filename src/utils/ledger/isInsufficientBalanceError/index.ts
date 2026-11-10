import { DatabaseError } from "pg";

/** The ledger refused to take a user balance below zero (CHECK ledger_accounts_user_non_negative). */
const isInsufficientBalanceError = ({ error }: { error: unknown }) =>
    error instanceof DatabaseError && error.code === "23514" && error.constraint === "ledger_accounts_user_non_negative";

export default isInsufficientBalanceError;
