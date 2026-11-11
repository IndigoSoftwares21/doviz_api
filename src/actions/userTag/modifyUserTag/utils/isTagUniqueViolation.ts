import { DatabaseError } from "pg";

/** Two users raced for the same tag: the database's UNIQUE (users.tag) decided. */
const isTagUniqueViolation = ({ error }: { error: unknown }) => error instanceof DatabaseError && error.code === "23505" && error.constraint === "users_tag_unique";

export default isTagUniqueViolation;
