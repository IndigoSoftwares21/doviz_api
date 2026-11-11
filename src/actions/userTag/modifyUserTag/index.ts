import { withTransaction } from "@/database";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import createPinVerification, { PinVerification } from "@/actions/pinVerification/createPinVerification";
import selectUnavailableTags from "@/schemaHelpers/selectUnavailableTags";
import selectTagOwnerName from "@/actions/userTag/fetchTagAvailability/queries/selectTagOwnerName";
import normaliseTag from "@/utils/ziktags/normaliseTag";
import tagFormatProblem from "@/utils/ziktags/tagFormatProblem";
import selectUserTagForUpdate from "./queries/selectUserTagForUpdate";
import updateUserTag from "./queries/updateUserTag";
import insertTagHold from "./queries/insertTagHold";
import isTagUniqueViolation from "./utils/isTagUniqueViolation";
import { heldUntil, nextChangeAt } from "./utils/tagDates";
import AUDIT_ACTIONS from "@/constants/auditActions";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import { ZIKTAG_FAILURE, ZIKTAG_REASON } from "@/constants/ziktags";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface IModifyUserTag {
    userId: string;
    value: string;
    pin: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}

class TagFailure extends Error {
    constructor(readonly failure: string, readonly nextChange: Date | null = null) {
        super(failure);
    }
}

/**
 * Sets or changes the user's Ziktag (a payments identifier). First set: free
 * (onboarding, before a PIN exists). A CHANGE needs the transfer PIN and is
 * allowed once per 30 days; the old tag is held for its owner for 30 days.
 * Re-setting the same tag is a no-op. The UNIQUE constraint settles races.
 */
const modifyUserTag = async ({ userId, value, pin, ipAddress, userAgent }: IModifyUserTag) => {
    const fail = (failure: string, extra: { verification?: PinVerification; nextChangeAt?: Date | null } = {}) => ({ data: null, failure, ...extra });
    const tag = normaliseTag({ value });
    const problem = tagFormatProblem({ tag });
    if (problem) return fail(problem === ZIKTAG_REASON.RESERVED ? ZIKTAG_FAILURE.RESERVED : ZIKTAG_FAILURE.INVALID);

    const current = await selectTagOwnerName({ userId });
    if (current?.tag === tag) return { data: { tag, changedAt: current.tagChangedAt, nextChangeAt: nextChangeAt(current.tagChangedAt) }, failure: null };

    const isChange = Boolean(current?.tag);
    if (isChange) {
        if (!pin) return fail(ZIKTAG_FAILURE.PIN_REQUIRED);
        const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return fail(ZIKTAG_FAILURE.PIN, { verification });
    }

    try {
        const data = await withTransaction(async (trx) => {
            const locked = await selectUserTagForUpdate({ trx, userId });
            if (locked.tag && !isChange) throw new TagFailure(ZIKTAG_FAILURE.PIN_REQUIRED); // set elsewhere meanwhile
            const allowedFrom = locked.tag ? nextChangeAt(locked.tagChangedAt) : null;
            if (allowedFrom && allowedFrom > new Date()) throw new TagFailure(ZIKTAG_FAILURE.COOLDOWN, allowedFrom);
            if ((await selectUnavailableTags({ tags: [tag], userId })).has(tag)) throw new TagFailure(ZIKTAG_FAILURE.TAKEN);

            const now = new Date();
            const saved = await updateUserTag({ trx, userId, tag, changedAt: now });
            if (locked.tag) await insertTagHold({ trx, userId, tag: locked.tag, releasedAt: now, heldUntil: heldUntil(now) });

            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.USER_TAG_SET,
                actorType: AUDIT_ACTOR_TYPE.USER,
                actorId: userId,
                entityType: AUDIT_ENTITY_TYPE.USER,
                entityId: userId,
                ipAddress,
                userAgent,
                metadata: { from: locked.tag, to: tag },
            });

            return { tag: saved.tag as string, changedAt: saved.tagChangedAt, nextChangeAt: nextChangeAt(saved.tagChangedAt) };
        });
        return { data, failure: null };
    } catch (error) {
        if (error instanceof TagFailure) return fail(error.failure, { nextChangeAt: error.nextChange });
        if (isTagUniqueViolation({ error })) return fail(ZIKTAG_FAILURE.TAKEN);
        throw error;
    }
};

export default modifyUserTag;
