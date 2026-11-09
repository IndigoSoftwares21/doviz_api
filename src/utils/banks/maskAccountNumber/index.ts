/** "0123456789" → "******6789". */
const maskAccountNumber = ({ accountNumber }: { accountNumber: string }) =>
    `${"*".repeat(Math.max(accountNumber.length - 4, 0))}${accountNumber.slice(-4)}`;

export default maskAccountNumber;
