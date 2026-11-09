import normalizeName from "@/utils/names/normalizeName";

/**
 * True when a bank account name contains the user's legal first AND last
 * name as whole words, in any order (middle names are optional). Guards
 * against withdrawals to someone else's account.
 */
const accountNameMatches = ({
    accountName,
    firstName,
    lastName,
}: {
    accountName: string;
    firstName: string;
    lastName: string;
}) => {
    const accountWords = new Set(normalizeName({ name: accountName }));
    const required = [...normalizeName({ name: firstName }), ...normalizeName({ name: lastName })];

    return required.length > 0 && required.every((word) => accountWords.has(word));
};

export default accountNameMatches;
