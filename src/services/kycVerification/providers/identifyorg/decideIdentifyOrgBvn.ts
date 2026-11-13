import { KYC_OUTCOME, KycVerification } from "../../kycVerifier";

export const IDENTIFYORG_REASONS = {
    notFound: "We couldn't find this BVN. Check it and try again.",
    name: "Your name doesn't match your BVN. Enter it exactly as it is on your BVN.",
    dateOfBirth: "Your date of birth doesn't match your BVN.",
    phone: "Your Ziks phone number isn't the one linked to your BVN. Use the number registered with your BVN, or update it at your bank.",
    gender: "Your gender doesn't match your BVN.",
    other: "Your details don't match your BVN. Check them and try again.",
    face: "Your selfie doesn't match your BVN photo. Retake it facing the camera, in good light, without glasses or a cap.",
};

/** Whether the phone on the BVN must be the user's verified Ziks phone (the strongest sign they own the BVN). */
export const REQUIRE_BVN_PHONE_MATCH = true;

const mismatched = (fields: unknown) => (Array.isArray(fields) ? fields.map((field) => String(field).toLowerCase()) : []);

/**
 * IdentifyOrg's BVN result → our decision. `match` false lists what didn't
 * agree in `mismatched_fields`; the first one a person can fix is the reason.
 * Gender is compared here (IdentifyOrg returns it, it doesn't match it).
 */
const decideIdentifyOrgBvn = ({ reply, gender }: { reply: Record<string, unknown>; gender: string }): KycVerification => {
    const reference = typeof reply.id === "string" ? reply.id : null;
    if (reply.status === "not_found") return { outcome: KYC_OUTCOME.REJECTED, reason: IDENTIFYORG_REASONS.notFound, reference, evidence: { bvnFound: false } };

    const off = reply.match === true ? [] : mismatched(reply.mismatched_fields);
    const has = (...names: string[]) => off.some((field) => names.some((name) => field.includes(name)));
    const record = (reply.data ?? {}) as Record<string, unknown>;
    const evidence = {
        bvnFound: true,
        name: !has("first_name", "last_name", "name"),
        dateOfBirth: !has("date_of_birth", "dob"),
        phone: !has("phone"),
        gender: String(record.gender ?? "").trim().toLowerCase() === gender.toLowerCase(),
        confidence: typeof reply.confidence_score === "number" ? reply.confidence_score : null,
    };
    const unexplained = reply.match !== true && off.length === 0;

    const reason =
        !evidence.name ? IDENTIFYORG_REASONS.name
        : !evidence.dateOfBirth ? IDENTIFYORG_REASONS.dateOfBirth
        : !evidence.phone && REQUIRE_BVN_PHONE_MATCH ? IDENTIFYORG_REASONS.phone
        : !evidence.gender ? IDENTIFYORG_REASONS.gender
        : unexplained ? IDENTIFYORG_REASONS.other
        : null;

    return { outcome: reason ? KYC_OUTCOME.REJECTED : KYC_OUTCOME.VERIFIED, reason, reference, evidence };
};

export default decideIdentifyOrgBvn;
