/** A short reference to quote to support, e.g. "ZT-3F9A1C2B7D4E" (from the transfer id). */
const transferReference = ({ id }: { id: string }) => `ZT-${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;

export default transferReference;
