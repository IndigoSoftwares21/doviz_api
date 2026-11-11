import { Kysely } from "kysely";
import { Database } from "@/database/types";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { REALTIME_EVENT } from "@/constants/realtime";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import type { ICompleteTransfer } from "../completeTransfer";

/**
 * Inside the send transaction: an audit row for each side (so either user's
 * history shows it), and pushes — both balances changed; the recipient also
 * gets `transfer.received`. NOTIFY is delivered only if the transaction commits.
 */
const recordTransferEvents = async ({
    trx,
    input,
    amount,
    senderTag,
}: {
    trx: Kysely<Database>;
    input: ICompleteTransfer;
    amount: string;
    senderTag: string | null;
}) => {
    const { id, senderId, recipientId, ipAddress, userAgent } = input;
    const entity = { entityType: AUDIT_ENTITY_TYPE.INTERNAL_TRANSFER, entityId: id };

    await createAuditLog({
        trx, action: AUDIT_ACTIONS.TRANSFER_SENT, actorType: AUDIT_ACTOR_TYPE.USER, actorId: senderId, ...entity,
        ipAddress, userAgent, metadata: { internalTransferId: id, recipientId, amount },
    });
    await createAuditLog({
        trx, action: AUDIT_ACTIONS.TRANSFER_RECEIVED, actorType: AUDIT_ACTOR_TYPE.USER, actorId: senderId, ...entity,
        metadata: { internalTransferId: id, recipientId, senderId, amount },
    });

    await publishUserEvent({ trx, userId: senderId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });
    await publishUserEvent({ trx, userId: recipientId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });
    await publishUserEvent({ trx, userId: recipientId, event: REALTIME_EVENT.TRANSFER_RECEIVED, data: { transferId: id, amount, senderTag } });
};

export default recordTransferEvents;
