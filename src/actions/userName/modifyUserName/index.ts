import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import createPinVerification, { PinVerification } from "@/actions/pinVerification/createPinVerification";
import selectUserNameForUpdate from "./queries/selectUserNameForUpdate";
import updateUserName from "./queries/updateUserName";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface IModifyUserName {
    userId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    pin?: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// data is null when a PIN was given and didn't verify; `verification` says
// why. The audit log keeps the previous name for fraud investigations.
const modifyUserName = async ({
    userId,
    firstName,
    middleName,
    lastName,
    pin,
    ipAddress,
    userAgent,
}: IModifyUserName) => {
    let verification: PinVerification | null = null;

    if (pin) {
        ({ data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent }));

        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) {
            return { data: null, verification };
        }
    }

    const data = await withTransaction(async (trx) => {
        const previous = await selectUserNameForUpdate({ trx, userId });

        const user = await updateUserName({
            trx,
            userId,
            firstName,
            middleName,
            lastName,
            nameUpdatedAt: new Date(),
        });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.USER_NAME_UPDATED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.USER,
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: {
                previous: previous.firstName ? previous : null,
                current: { firstName, middleName, lastName },
            },
        });

        return user;
    });

    return { data, verification };
};

export default modifyUserName;
