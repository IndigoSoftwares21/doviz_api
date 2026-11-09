/** Opaque cursor for the statement: the last ledger entry id the client saw. */
const encodeStatementCursor = ({ entryId }: { entryId: string }) => Buffer.from(entryId, "utf8").toString("base64url");

export default encodeStatementCursor;
