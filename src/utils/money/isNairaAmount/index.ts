/** A positive naira amount as a string with at most 2 decimals (kobo). */
const isNairaAmount = ({ value }: { value: string }) => /^(?:0|[1-9]\d{0,14})(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;

export default isNairaAmount;
