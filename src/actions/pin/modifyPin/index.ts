import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import hashPin from "@/utils/auth/hashPin";
import updatePinHash from "./queries/updatePinHash";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import { AUDIT_ACTOR_TYPE } from "@/constants/auditTargets";

interface IModifyPin {
    userId: string;
    currentPin: string;
    newPin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// data is null when the current PIN didn't verify; `verification` says why.
const modifyPin = async ({ userId, currentPin, newPin, ipAddress, userAgent }: IModifyPin) => {
    const { data: verification } = await createPinVerification({
        userId,
        pin: currentPin,
        ipAddress,
        userAgent,
    });

    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) {
        return { data: null, verification };
    }

    const pinHash = await hashPin({ userId, pin: newPin });

    const data = await withTransaction(async (trx) => {
        const pinRow = await updatePinHash({ trx, userId, pinHash, updatedAt: new Date() });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PIN_CHANGED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            ipAddress,
            userAgent,
        });

        return { pinChangedAt: pinRow.updatedAt };
    });

    return { data, verification };
};

export default modifyPin;
