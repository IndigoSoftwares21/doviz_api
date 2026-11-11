import { Kysely } from "kysely";
import { withTransaction } from "@/database";
import { Database } from "@/database/types";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchNairaDeposit from "@/actions/nairaDeposit/fetchNairaDeposit";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import updatePendingDepositsExpired from "./queries/updatePendingDepositsExpired";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

/**
 * Inside a transaction: closes the user's unpaid top-ups (one, or all but
 * one), audits each and tells the app. Nothing is lost — money sent to a
 * closed account is still credited when it arrives.
 */
export const closePendingDeposits = async ({ trx, userId, id, exceptId, reason }: { trx: Kysely<Database>; userId: string; id?: string; exceptId?: string; reason: string }) => {
    const closed = await updatePendingDepositsExpired({ trx, userId, id, exceptId });
    for (const row of closed) {
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.NAIRA_DEPOSIT_CANCELLED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.NAIRA_DEPOSIT,
            entityId: row.id,
            metadata: { nairaDepositId: row.id, reason },
        });
        await publishUserEvent({ trx, userId, event: REALTIME_EVENT.NAIRA_DEPOSIT_UPDATED, data: { nairaDepositId: row.id, status: "expired" } });
    }
    return closed;
};

/**
 * The user no longer wants this top-up: stop offering its account. Returns
 * the deposit as it now stands (null if it isn't theirs). Already paid or
 * finished top-ups are left as they are.
 */
const createNairaDepositCancellation = async ({ userId, nairaDepositId }: { userId: string; nairaDepositId: string }) => {
    const { data: existing } = await fetchNairaDeposit({ userId, nairaDepositId });
    if (!existing) return { data: null };

    await withTransaction((trx) => closePendingDeposits({ trx, userId, id: nairaDepositId, reason: "cancelled_by_user" }));

    const { data } = await fetchNairaDeposit({ userId, nairaDepositId });
    return { data };
};

export default createNairaDepositCancellation;
