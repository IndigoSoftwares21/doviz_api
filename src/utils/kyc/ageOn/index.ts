/** Whole years from an ISO (YYYY-MM-DD) birth date to `today`, in UTC. */
const ageOn = ({ dateOfBirth, today }: { dateOfBirth: string; today: Date }) => {
    const [year, month, day] = dateOfBirth.split("-").map(Number);
    const birthdayPassed = today.getUTCMonth() + 1 > month || (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
    return today.getUTCFullYear() - year - (birthdayPassed ? 0 : 1);
};

export default ageOn;
