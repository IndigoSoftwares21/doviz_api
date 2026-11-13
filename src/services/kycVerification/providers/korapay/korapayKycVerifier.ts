import axios from "axios";
import monitoring from "@/utils/monitoring";
import KORAPAY from "@/services/collections/providers/korapay/constants";
import { KYC_OUTCOME, KycVerification, KycVerifier } from "../../kycVerifier";
import { KorapayBvnRecord } from "./korapayIdentityTypes";
import decideKorapayBvn from "./decideKorapayBvn";

const TIMEOUT_MS = 30_000;
const unavailable: KycVerification = { outcome: KYC_OUTCOME.UNAVAILABLE, reason: null, reference: null, evidence: {} };
const notFound: KycVerification = { outcome: KYC_OUTCOME.REJECTED, reason: "We couldn't find this BVN. Check it and try again.", reference: null, evidence: { bvnFound: false } };

/**
 * Korapay Identity: BVN lookup with data matching (names, date of birth) and,
 * for `bvn_selfie`, facial matching against the BVN photo. Uses its own key
 * (KORAPAY_IDENTITY_SECRET_KEY, falling back to KORAPAY_SECRET_KEY). The
 * response holds the person's government record and photo: only the match
 * results are read; nothing from it is logged or kept.
 */
class KorapayKycVerifier implements KycVerifier {
    readonly name = "korapay";
    readonly levels = ["bvn", "bvn_selfie"] as const;

    constructor(
        private readonly secretKey: string,
        private readonly baseUrl: string = process.env.KORAPAY_BASE_URL || KORAPAY.DEFAULT_BASE_URL,
    ) {}

    async verify({ level, values }: { level: string; values: Record<string, string> }): Promise<KycVerification> {
        const withSelfie = level === "bvn_selfie";
        const body = {
            id: values.bvn,
            verification_consent: true,
            validation: {
                first_name: values.first_name,
                last_name: values.last_name,
                date_of_birth: values.date_of_birth,
                ...(withSelfie ? { selfie: values.selfie } : {}),
            },
        };

        let response;
        try {
            response = await axios.post(`${this.baseUrl.replace(/\/+$/, "")}/identities/ng/bvn`, body, {
                headers: { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json" },
                timeout: TIMEOUT_MS,
                validateStatus: () => true,
            });
        } catch {
            monitoring.warn("Korapay BVN check → network error");
            return unavailable;
        }

        monitoring.info(`Korapay BVN check → ${response.status}`);
        const envelope = (response.data ?? {}) as { status?: boolean; message?: string; data?: KorapayBvnRecord };
        if (response.status === 401 || response.status === 403) {
            monitoring.error("Korapay refused our identity key — check KORAPAY_IDENTITY_SECRET_KEY and that Identity is enabled", new Error(String(response.status)));
            return unavailable;
        }
        if (response.status >= 500 || response.status === 429) return unavailable;
        if (response.status >= 400 || envelope.status === false || !envelope.data) {
            // Korapay answers a BVN it can't find with a 4xx; anything else is ours to look at.
            if (response.status === 404 || /not\s*found|invalid|no record/i.test(envelope.message ?? "")) return notFound;
            monitoring.error(`Korapay BVN check refused (${response.status})`, new Error(envelope.message ?? "refused"));
            return unavailable;
        }
        return decideKorapayBvn({ record: envelope.data, gender: values.gender, withSelfie });
    }
}

export default KorapayKycVerifier;
