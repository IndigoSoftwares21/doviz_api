/**
 * A Nigerian mobile number in local 11-digit form ("08126257120"), from any
 * common way of writing it: +234 812 625 7120, 2348126257120, 8126257120,
 * 0812-625-7120. null when it isn't a Nigerian mobile number.
 */
const toLocalPhoneNumber = ({ value }: { value: string }) => {
    const digits = value.replace(/[\s\-()]/g, "").replace(/^\+/, "");
    if (!/^\d+$/.test(digits)) return null;

    const local = digits.startsWith("234") && digits.length === 13 ? `0${digits.slice(3)}` : digits.length === 10 ? `0${digits}` : digits;
    return /^0[789][01]\d{8}$/.test(local) ? local : null;
};

export default toLocalPhoneNumber;
