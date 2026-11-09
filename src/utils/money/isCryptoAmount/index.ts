/** A positive decimal string with at most `decimals` places (e.g. "0.0125"). */
const isCryptoAmount = ({ value, decimals }: { value: string; decimals: number }) => {
    const pattern = decimals === 0 ? /^[1-9]\d{0,19}$/ : new RegExp(`^(?:0|[1-9]\\d{0,19})(?:\\.\\d{1,${decimals}})?$`);
    return pattern.test(value) && /[1-9]/.test(value);
};

export default isCryptoAmount;
