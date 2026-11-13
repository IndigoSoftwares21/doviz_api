import { createEnvKycKeyring, KycKeyring } from "./kycKeyring";

let keyring: KycKeyring | null = null;

/** The app's keyring, built once from the environment (throws if it's missing or malformed). */
const getKycKeyring = () => (keyring ??= createEnvKycKeyring());

/** Tests only. */
export const resetKycKeyring = () => {
    keyring = null;
};

export default getKycKeyring;
