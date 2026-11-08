import { verify } from "crypto";
import parseBiometricPublicKey from "@/utils/auth/parseBiometricPublicKey";

// ECDSA P-256 / SHA-256 over the UTF-8 challenge string, DER-encoded
// signature (iOS: .ecdsaSignatureMessageX962SHA256, Android: SHA256withECDSA).
// Base64 or base64url signatures are accepted.
const verifyBiometricSignature = ({
    publicKey,
    message,
    signature,
}: {
    publicKey: string;
    message: string;
    signature: string;
}) => {
    const keyObject = parseBiometricPublicKey({ publicKey });

    if (!keyObject) {
        return false;
    }

    try {
        const isValid = verify(
            "sha256",
            Buffer.from(message, "utf8"),
            { key: keyObject, dsaEncoding: "der" },
            Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
        );

        return isValid;
    } catch {
        return false;
    }
};

export default verifyBiometricSignature;
