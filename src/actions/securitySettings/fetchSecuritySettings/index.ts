import selectTransactionPinStatus from "./queries/selectTransactionPinStatus";
import selectBiometricDevices from "./queries/selectBiometricDevices";

const fetchSecuritySettings = async ({ userId }: { userId: string }) => {
    const [pinStatus, biometricDevices] = await Promise.all([
        selectTransactionPinStatus({ userId }),
        selectBiometricDevices({ userId }),
    ]);

    const isLocked = !!pinStatus?.lockedUntil && pinStatus.lockedUntil > new Date();

    const data = {
        pin: {
            isSet: !!pinStatus,
            lockedUntil: isLocked ? pinStatus!.lockedUntil : null,
            updatedAt: pinStatus?.updatedAt ?? null,
        },
        biometricDevices,
    };

    return { data };
};

export default fetchSecuritySettings;
