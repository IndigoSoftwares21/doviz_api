import { randomBytes } from "crypto";
import { KycKeyring } from "./kycKeyring";
import { sealField } from "./kycFieldCipher";
import { KycDetails, SealedKyc } from "./types";

/** Binds ciphertexts to their owner and column (the AEAD context). */
export const fieldContext = ({ userId, field }: { userId: string; field: string }) => `ziks:kyc:${userId}:${field}`;
export const keyContext = ({ userId }: { userId: string }) => `ziks:kyc-key:${userId}`;

/**
 * Encrypts a user's KYC details for storage: a fresh random data key for this
 * record, each field sealed with it, and the data key wrapped by the master key.
 */
const sealKyc = ({ userId, details, keyring }: { userId: string; details: KycDetails; keyring: KycKeyring }): SealedKyc => {
    const dataKey = randomBytes(32);
    try {
        const seal = (field: string, value: string) => sealField({ dataKey, value, context: fieldContext({ userId, field }) });
        const { wrappedKey, version } = keyring.wrap({ dataKey, context: keyContext({ userId }) });
        return {
            keyVersion: version,
            wrappedKey,
            bvnEnc: seal("bvn", details.bvn),
            firstNameEnc: seal("first_name", details.firstName),
            middleNameEnc: details.middleName ? seal("middle_name", details.middleName) : null,
            lastNameEnc: seal("last_name", details.lastName),
            dateOfBirthEnc: seal("date_of_birth", details.dateOfBirth),
            genderEnc: seal("gender", details.gender),
            addressEnc: seal("address", details.address),
        };
    } finally {
        dataKey.fill(0);
    }
};

export default sealKyc;
