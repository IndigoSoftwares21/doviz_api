import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import hashPin from "@/utils/auth/hashPin";
import insertTransactionPin from "./queries/insertTransactionPin";

interface ICreatePin {
    userId: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

const createPin = async ({ userId, pin, ipAddress, userAgent }: ICreatePin) => {
    // bcrypt is slow on purpose — hash before opening the transaction.
    const pinHash = await hashPin({ userId, pin });

    const data = await withTransaction(async (trx) => {
        const pinRow = await insertTransactionPin({ trx, userId, pinHash });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PIN_CREATED,
            actorType: "user",
            actorId: userId,
            ipAddress,
            userAgent,
        });

        return { pinSetAt: pinRow.createdAt };
    });

    return { data };
};

export default createPin;
