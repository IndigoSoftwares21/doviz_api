/** "  @Ada_O " → "ada_o": trim, drop one leading "@", lowercase. Doesn't validate. */
const normaliseTag = ({ value }: { value: string }) => value.trim().replace(/^@/, "").toLowerCase();

export default normaliseTag;
