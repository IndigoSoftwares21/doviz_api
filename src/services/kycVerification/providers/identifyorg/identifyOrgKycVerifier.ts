import monitoring from "@/utils/monitoring";
import parseImageDataUri from "@/utils/kyc/parseImageDataUri";
import { KYC_OUTCOME, KycVerification, KycVerifier } from "../../kycVerifier";
import IdentifyOrgClient, { IdentifyOrgReply } from "./identifyOrgClient";
import decideIdentifyOrgBvn, { IDENTIFYORG_REASONS } from "./decideIdentifyOrgBvn";

const unavailable: KycVerification = { outcome: KYC_OUTCOME.UNAVAILABLE, reason: null, reference: null, evidence: {} };

/** +2348012345678 → 08012345678 (how BVN records hold Nigerian numbers). */
const localPhone = (e164: string) => (e164.startsWith("+234") ? `0${e164.slice(4)}` : e164);

/**
 * IdentifyOrg: BVN lookup matched against the user's names, date of birth
 * and verified phone (bvn level), plus — for bvn_selfie — the selfie compared
 * with the official BVN photo (`/v1/verify/bvn-face`; on their price list as
 * "bvn_face" though not in their public docs — confirmed in sandbox,
 * 2026-11-13). The face check runs only once the BVN passes, so a wrong BVN
 * costs one check, not two. No liveness check (by choice, for cost).
 */
class IdentifyOrgKycVerifier implements KycVerifier {
    readonly name = "identifyorg";
    readonly levels = ["bvn", "bvn_selfie"] as const;

    constructor(private readonly client: IdentifyOrgClient) {}

    async verify({ level, values, contact }: { level: string; values: Record<string, string>; contact: { phoneNumber: string } }): Promise<KycVerification> {
        const bvnReply = await this.client.postJson("/v1/verify/bvn", {
            bvn: values.bvn,
            first_name: values.first_name,
            last_name: values.last_name,
            date_of_birth: values.date_of_birth,
            phone_number: localPhone(contact.phoneNumber),
        });
        const bvn = this.read("BVN check", bvnReply);
        if (!bvn) return unavailable;
        const decided = decideIdentifyOrgBvn({ reply: bvn, gender: values.gender });
        if (decided.outcome !== KYC_OUTCOME.VERIFIED || level !== "bvn_selfie") return decided;

        const image = parseImageDataUri({ value: values.selfie ?? "", maxBytes: 1_500_000 });
        if (!image) return { ...decided, outcome: KYC_OUTCOME.REJECTED, reason: IDENTIFYORG_REASONS.face, evidence: { ...decided.evidence, face: false } };
        const face = this.read("BVN face check", await this.client.postImage("/v1/verify/bvn-face", "selfie", image, { bvn: values.bvn }));
        if (!face) return unavailable;

        const data = (face.data ?? {}) as Record<string, unknown>;
        const similarity = typeof data.similarity_score === "number" ? data.similarity_score : typeof face.confidence_score === "number" ? face.confidence_score : null;
        const matched = face.status === "success" && face.match === true;
        return {
            ...decided,
            outcome: matched ? KYC_OUTCOME.VERIFIED : KYC_OUTCOME.REJECTED,
            reason: matched ? null : IDENTIFYORG_REASONS.face,
            evidence: { ...decided.evidence, face: matched, faceSimilarity: similarity },
        };
    }

    /**
     * A usable reply, or null when the check couldn't run (logged without
     * personal data). A BVN that doesn't exist is a usable reply, not an error.
     */
    private read(what: string, reply: IdentifyOrgReply): Record<string, unknown> | null {
        if (reply.status === null) {
            monitoring.warn(`IdentifyOrg ${what} → ${reply.code === "ECONNABORTED" ? "timed out" : "network error"} (${reply.code})`);
            return null;
        }
        monitoring.info(`IdentifyOrg ${what} → ${reply.status}`);
        if (reply.status >= 200 && reply.status < 300) return reply.data;
        if (reply.status === 404 || reply.data.status === "not_found") return { ...reply.data, status: "not_found" };

        const error = (reply.data.error ?? {}) as Record<string, unknown>;
        const message = String(error.message ?? reply.data.message ?? error.code ?? "no message");
        if (reply.status === 429 || reply.status === 502 || reply.status >= 500) {
            monitoring.warn(`IdentifyOrg ${what} unavailable (${reply.status}: ${message})`);
        } else {
            // Our setup: key, country, wallet funds, or a request IdentifyOrg didn't accept.
            monitoring.error(`IdentifyOrg refused the ${what} (${reply.status}: ${message}) — check IDENTIFYORG_API_KEY, wallet funds and the request`, new Error(String(reply.status)));
        }
        return null;
    }
}

export default IdentifyOrgKycVerifier;
