import { db } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import { AUDIT_ACTOR_TYPE } from "@/constants/auditTargets";

/** Audit-only: nothing from a rejected webhook is stored or processed. */
const createProviderWebhookRejection = async ({ provider, ipAddress }: { provider: string; ipAddress: string | null }) => {
    const { data } = await createAuditLog({
        trx: db,
        action: AUDIT_ACTIONS.PROVIDER_WEBHOOK_REJECTED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        ipAddress,
        metadata: { provider, ip: ipAddress },
    });

    return { data };
};

export default createProviderWebhookRejection;
