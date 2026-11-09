import { Kysely } from "kysely";
import { Database } from "@/database/types";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import { CodeFailureReason } from "@/constants/codeFailureReason";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface IAuditPinResetFailure {
    trx: Kysely<Database>;
    userId: string;
    otpId: string | null;
    reason: CodeFailureReason;
    attempts?: number;
    ipAddress: string | null;
    userAgent: string | null;
}

/** Records a failed PIN reset (no live code, or a wrong one). */
const auditPinResetFailure = ({ trx, userId, otpId, reason, attempts, ipAddress, userAgent }: IAuditPinResetFailure) =>
    createAuditLog({
        trx,
        action: AUDIT_ACTIONS.PIN_RESET_FAILED,
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: otpId ? AUDIT_ENTITY_TYPE.PHONE_OTP : undefined,
        entityId: otpId ?? undefined,
        ipAddress,
        userAgent,
        metadata: attempts === undefined ? { reason } : { reason, attempts },
    });

export default auditPinResetFailure;
