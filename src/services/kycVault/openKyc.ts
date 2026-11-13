import { KycGender } from "@/constants/kyc";
import { KycKeyring } from "./kycKeyring";
import { openField } from "./kycFieldCipher";
import { fieldContext, keyContext } from "./sealKyc";
import { KycDetails, SealedKyc } from "./types";

/**
 * Decrypts a stored KYC record. Throws if any part was altered or belongs to
 * another user. Call only through openUserKyc, which audits every read.
 */
const openKyc = ({ userId, sealed, keyring }: { userId: string; sealed: SealedKyc; keyring: KycKeyring }): KycDetails => {
    const dataKey = keyring.unwrap({ wrappedKey: sealed.wrappedKey, version: sealed.keyVersion, context: keyContext({ userId }) });
    try {
        const open = (field: string, value: string) => openField({ dataKey, sealed: value, context: fieldContext({ userId, field }) });
        return {
            bvn: open("bvn", sealed.bvnEnc),
            firstName: open("first_name", sealed.firstNameEnc),
            middleName: sealed.middleNameEnc ? open("middle_name", sealed.middleNameEnc) : null,
            lastName: open("last_name", sealed.lastNameEnc),
            dateOfBirth: open("date_of_birth", sealed.dateOfBirthEnc),
            gender: open("gender", sealed.genderEnc) as KycGender,
            address: open("address", sealed.addressEnc),
        };
    } finally {
        dataKey.fill(0);
    }
};

export default openKyc;
