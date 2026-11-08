import { createPublicKey } from "crypto";

// Accepts only a base64 DER SPKI ECDSA P-256 public key — what the iOS Secure
// Enclave and Android Keystore produce. Returns null for anything else.
const parseBiometricPublicKey = ({ publicKey }: { publicKey: string }) => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey) || publicKey.length > 512) {
        return null;
    }

    try {
        const keyObject = createPublicKey({
            key: Buffer.from(publicKey, "base64"),
            format: "der",
            type: "spki",
        });

        if (
            keyObject.asymmetricKeyType !== "ec" ||
            keyObject.asymmetricKeyDetails?.namedCurve !== "prime256v1"
        ) {
            return null;
        }

        return keyObject;
    } catch {
        return null;
    }
};

export default parseBiometricPublicKey;
