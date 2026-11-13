import { randomBytes } from "crypto";
import { KycKeyring } from "./kycKeyring";
import { sealField } from "./kycFieldCipher";

/** Binds a ciphertext to its owner, field and row (the AEAD context): it won't open anywhere else. */
export const valueContext = ({ userId, fieldKey, rowId }: { userId: string; fieldKey: string; rowId: string }) =>
    `ziks:kyc:${userId}:${fieldKey}:${rowId}`;

/** Encrypts one KYC value for storage, with its own fresh data key (wrapped by the master key). */
const sealKycValue = ({
    userId,
    fieldKey,
    rowId,
    value,
    keyring,
}: {
    userId: string;
    fieldKey: string;
    rowId: string;
    value: string;
    keyring: KycKeyring;
}) => {
    const dataKey = randomBytes(32);
    try {
        const context = valueContext({ userId, fieldKey, rowId });
        const { wrappedKey, version } = keyring.wrap({ dataKey, context });
        return { keyVersion: version, wrappedKey, valueEnc: sealField({ dataKey, value, context }) };
    } finally {
        dataKey.fill(0);
    }
};

export default sealKycValue;
