import selectUserOverview from "./queries/selectUserOverview";

// Onboarding needs a legal name, then a transfer PIN. Email belongs to KYC
// and doesn't block onboarding.
const fetchUser = async ({ userId, deviceId }: { userId: string; deviceId: string }) => {
    const user = await selectUserOverview({ userId, deviceId });

    const hasName = !!user.firstName && !!user.lastName;
    const nextStep = !hasName ? "name" : !user.hasPin ? "pin" : null;

    const data = {
        id: user.id,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        /** The Ziktag (@handle), lowercase without "@"; null until chosen. */
        tag: user.tag,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        accountStatus: user.status,
        createdAt: user.createdAt,
        setup: {
            hasName,
            hasPin: user.hasPin,
            hasVerifiedEmail: !!user.emailVerifiedAt,
            biometricsEnabled: user.biometricsEnabled,
        },
        onboarding: {
            isComplete: nextStep === null,
            nextStep,
        },
    };

    return { data };
};

export default fetchUser;
