import { KycKeyring } from "./kycKeyring";
import { openField } from "./kycFieldCipher";
import { valueContext } from "./sealKycValue";

/**
 * Decrypts one stored KYC value. Throws if it was altered, or was moved to
 * another user, field or row. Call only through openUserKyc, which audits reads.
 */
const openKycValue = ({
    userId,
    fieldKey,
    rowId,
    sealed,
    keyring,
}: {
    userId: string;
    fieldKey: string;
    rowId: string;
    sealed: { keyVersion: number; wrappedKey: string; valueEnc: string };
    keyring: KycKeyring;
}) => {
    const context = valueContext({ userId, fieldKey, rowId });
    const dataKey = keyring.unwrap({ wrappedKey: sealed.wrappedKey, version: sealed.keyVersion, context });
    try {
        return openField({ dataKey, sealed: sealed.valueEnc, context });
    } finally {
        dataKey.fill(0);
    }
};

export default openKycValue;
