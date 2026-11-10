import { withTransaction } from "@/database";
import collectionProviderRegistry from "@/services/collections/collectionProviderRegistry";
import createNairaDepositCredit from "@/actions/nairaDepositCredit/createNairaDepositCredit";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import { REALTIME_EVENT } from "@/constants/realtime";
import selectNairaDepositForSync from "./queries/selectNairaDepositForSync";
import updateNairaDepositStatus from "./queries/updateNairaDepositStatus";
import updateNairaDepositChecked from "./queries/updateNairaDepositChecked";
import {
    NAIRA_DEPOSIT_STATUS,
    NAIRA_DEPOSIT_SYNC_OUTCOME,
    NairaDepositSyncOutcome,
    PROVIDER_TRANSFER_STATUS,
} from "@/constants/nairaDeposits";

const FINAL: string[] = [NAIRA_DEPOSIT_STATUS.COMPLETED, NAIRA_DEPOSIT_STATUS.FAILED];
const FAILED_REASON = "This transfer didn't go through. If you were debited, your bank will reverse it.";

/**
 * Brings one deposit in line with the provider's OWN record (fetched here,
 * never taken from a webhook body). Safe to call any number of times: the
 * credit locks the row and does nothing once it's final.
 *   completed → credit the user (also for an expired account paid late)
 *   failed    → failed (a pending deposit only)
 *   expired, or past its expiry by our clock → expired (still credited if paid later)
 *   otherwise → still waiting
 */
const syncNairaDeposit = async ({ nairaDepositId }: { nairaDepositId: string }) => {
    const deposit = await selectNairaDepositForSync({ id: nairaDepositId });
    if (!deposit) throw new Error(`Naira deposit ${nairaDepositId} not found`);
    if (FINAL.includes(deposit.status)) return { data: { outcome: NAIRA_DEPOSIT_SYNC_OUTCOME.UNCHANGED as NairaDepositSyncOutcome } };

    const record = await collectionProviderRegistry
        .get({ name: deposit.provider })
        .getBankTransfer({ externalId: deposit.id, providerReference: deposit.providerReference });

    const outcome = await withTransaction(async (trx): Promise<NairaDepositSyncOutcome> => {
        if (record?.status === PROVIDER_TRANSFER_STATUS.COMPLETED) {
            const { data } = await createNairaDepositCredit({ trx, nairaDepositId: deposit.id, record });
            return data.credited ? NAIRA_DEPOSIT_SYNC_OUTCOME.CREDITED : NAIRA_DEPOSIT_SYNC_OUTCOME.UNCHANGED;
        }

        const isPending = deposit.status === NAIRA_DEPOSIT_STATUS.PENDING;

        if (isPending && record?.status === PROVIDER_TRANSFER_STATUS.FAILED) {
            const updated = await updateNairaDepositStatus({ trx, id: deposit.id, from: NAIRA_DEPOSIT_STATUS.PENDING, status: NAIRA_DEPOSIT_STATUS.FAILED, failureReason: FAILED_REASON, final: true });
            if (!updated) return NAIRA_DEPOSIT_SYNC_OUTCOME.UNCHANGED;
            await publishUserEvent({ trx, userId: deposit.userId, event: REALTIME_EVENT.NAIRA_DEPOSIT_UPDATED, data: { nairaDepositId: deposit.id, status: NAIRA_DEPOSIT_STATUS.FAILED } });
            return NAIRA_DEPOSIT_SYNC_OUTCOME.FAILED;
        }

        const lapsed = record?.status === PROVIDER_TRANSFER_STATUS.EXPIRED || (deposit.expiresAt !== null && deposit.expiresAt.getTime() < Date.now());
        if (isPending && lapsed) {
            const updated = await updateNairaDepositStatus({ trx, id: deposit.id, from: NAIRA_DEPOSIT_STATUS.PENDING, status: NAIRA_DEPOSIT_STATUS.EXPIRED, failureReason: null, final: false });
            if (!updated) return NAIRA_DEPOSIT_SYNC_OUTCOME.UNCHANGED;
            await publishUserEvent({ trx, userId: deposit.userId, event: REALTIME_EVENT.NAIRA_DEPOSIT_UPDATED, data: { nairaDepositId: deposit.id, status: NAIRA_DEPOSIT_STATUS.EXPIRED } });
            return NAIRA_DEPOSIT_SYNC_OUTCOME.EXPIRED;
        }

        await updateNairaDepositChecked({ trx, id: deposit.id });
        return NAIRA_DEPOSIT_SYNC_OUTCOME.PENDING;
    });

    return { data: { outcome } };
};

export default syncNairaDeposit;
