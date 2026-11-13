import { KycGender } from "@/constants/kyc";

/** A user's KYC details in the clear — only ever inside the vault and its callers' memory. */
export interface KycDetails {
    bvn: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    /** ISO date, YYYY-MM-DD. */
    dateOfBirth: string;
    gender: KycGender;
    address: string;
}

/** The encrypted columns of user_kyc, as stored. */
export interface SealedKyc {
    keyVersion: number;
    wrappedKey: string;
    bvnEnc: string;
    firstNameEnc: string;
    middleNameEnc: string | null;
    lastNameEnc: string;
    dateOfBirthEnc: string;
    genderEnc: string;
    addressEnc: string;
}
