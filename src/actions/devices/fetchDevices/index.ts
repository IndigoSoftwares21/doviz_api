import selectUserDevices from "./queries/selectUserDevices";

const fetchDevices = async ({ userId, currentDeviceId }: { userId: string; currentDeviceId: string }) => {
    const deviceRows = await selectUserDevices({ userId, now: new Date() });

    const data = deviceRows.map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        lastSeenAt: device.lastSeenAt,
        trustedAt: device.trustedAt,
        firstSeenAt: device.createdAt,
        hasActiveSession: device.hasActiveSession,
        biometricsEnabled: device.biometricsEnabled,
        isCurrent: device.deviceId === currentDeviceId,
    }));

    return { data };
};

export default fetchDevices;
