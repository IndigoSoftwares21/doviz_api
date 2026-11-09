const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the ledger entry id inside a cursor, or null if it isn't a valid cursor. */
const decodeStatementCursor = ({ cursor }: { cursor: string }) => {
    try {
        const entryId = Buffer.from(cursor, "base64url").toString("utf8");
        return UUID.test(entryId) ? entryId : null;
    } catch {
        return null;
    }
};

export default decodeStatementCursor;
