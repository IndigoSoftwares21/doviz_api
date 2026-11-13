import { withTransaction } from "@/database";
import openUserKyc from "@/actions/userKyc/openUserKyc";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import fetchVirtualAccount from "@/actions/virtualAccount/fetchVirtualAccount";
import fetchAccountNumberProvider from "@/actions/nairaFunding/fetchAccountNumberProvider";
import getVirtualAccountProvider from "@/services/virtualAccounts/getVirtualAccountProvider";
import { VIRTUAL_ACCOUNT_ERROR, VirtualAccountProviderError } from "@/services/virtualAccounts/virtualAccountProvider";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import monitoring from "@/utils/monitoring";
import selectAccountHolder from "./queries/selectAccountHolder";
import insertVirtualAccount from "./queries/insertVirtualAccount";
import virtualAccountCustomerRef from "./utils/virtualAccountCustomerRef";
import ACTION_FAILURE, { ActionFailure } from "@/constants/actionFailure";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";
import { REALTIME_EVENT } from "@/constants/realtime";
import { VIRTUAL_ACCOUNT_STATUS } from "@/constants/nairaFunding";

type Account = Awaited<ReturnType<typeof fetchVirtualAccount>>["data"];

/**
 * Gives a verified user their personal account number, from their verified
 * KYC (decrypted for this purpose only, audited). Idempotent and race-safe:
 * the automatic call after verification and the "Get my account number"
 * button may both run — the provider and the database each make one account.
 */
const createVirtualAccount = async ({ userId }: { userId: string }) => {
    const result = (data: Account | null, failure: ActionFailure | null, isNew = false) => ({ data, failure, isNew });
    const current = await fetchVirtualAccount({ userId });
    if (current.data.status === VIRTUAL_ACCOUNT_STATUS.ACTIVE) return result(current.data, null);

    const { data: providerName } = await fetchAccountNumberProvider();
    if (!providerName) return result(null, ACTION_FAILURE.ACCOUNT_NUMBERS_OFF);
    const holder = await selectAccountHolder({ userId });
    if (!holder.activeKycRecordId) return result(null, ACTION_FAILURE.KYC_REQUIRED);
    const email = holder.email ?? process.env.VIRTUAL_ACCOUNT_FALLBACK_EMAIL ?? null;
    if (!email) {
        monitoring.error("Account numbers need an email: set VIRTUAL_ACCOUNT_FALLBACK_EMAIL for users without one", new Error("no email"));
        return result(null, ACTION_FAILURE.PROVIDER_UNAVAILABLE);
    }

    const provider = getVirtualAccountProvider({ name: providerName });
    const customerRef = virtualAccountCustomerRef({ userId });
    const { data: kyc } = await openUserKyc({ recordId: holder.activeKycRecordId, purpose: "create_bank_account" });
    const values = kyc!.values;

    let issued;
    try {
        issued = await provider.createAccount({
            customerRef,
            firstName: values.first_name,
            middleName: values.middle_name ?? null,
            lastName: values.last_name,
            dateOfBirth: values.date_of_birth,
            gender: values.gender,
            address: values.address,
            city: values.city ?? null,
            bvn: values.bvn,
            phoneNumber: holder.phoneNumber,
            email,
        });
    } catch (error) {
        if (error instanceof VirtualAccountProviderError) {
            if (error.code === VIRTUAL_ACCOUNT_ERROR.REJECTED) monitoring.error(`Account number refused for a verified user (${provider.name}) — needs review`, error);
            return result(null, error.code === VIRTUAL_ACCOUNT_ERROR.REJECTED ? ACTION_FAILURE.VIRTUAL_ACCOUNT_REFUSED : ACTION_FAILURE.PROVIDER_UNAVAILABLE);
        }
        throw error;
    }

    const isNew = await withTransaction(async (trx) => {
        const row = await insertVirtualAccount({
            trx,
            values: { userId, kycRecordId: holder.activeKycRecordId!, provider: provider.name, environment: provider.environment, customerRef, ...issued },
        });
        if (!row) return false;
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.VIRTUAL_ACCOUNT_CREATED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.VIRTUAL_ACCOUNT,
            entityId: row.id,
            metadata: { provider: provider.name, kycRecordId: holder.activeKycRecordId },
        });
        await publishUserEvent({ trx, userId, event: REALTIME_EVENT.VIRTUAL_ACCOUNT_READY, data: { accountNumber: issued.accountNumber } });
        return true;
    });

    const { data } = await fetchVirtualAccount({ userId });
    return result(data, null, isNew);
};

export default createVirtualAccount;
