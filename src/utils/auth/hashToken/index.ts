import { createHash } from "crypto";

// Refresh tokens are 256 bits of CSPRNG output, so a fast unsalted SHA-256
// is sufficient (unlike passwords or OTPs, they can't be brute-forced).
const hashToken = ({ token }: { token: string }) => {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    return tokenHash;
};

export default hashToken;
