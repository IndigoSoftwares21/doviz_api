import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import createBankResolution from "@/actions/bankResolution/createBankResolution";
import maskAccountNumber from "@/utils/banks/maskAccountNumber";
import selectPrimaryBankAccount from "./queries/selectPrimaryBankAccount";
import insertBankAccount from "./queries/insertBankAccount";
import selectBankName from "./queries/selectBankName";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface ICreateBankAccount {
    userId: string;
    bankId: string;
    accountNumber: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Saves a withdrawal account: PIN first, then the bank's own account name
 * must match the user's legal name. The first account becomes primary.
 */
const createBankAccount = async ({ userId, bankId, accountNumber, pin, ipAddress, userAgent }: ICreateBankAccount) => {
    const { data: verification } = await createPinVerification({ userId, pin, ipAddress, userAgent });
    if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return { data: null, failure: ACTION_FAILURE.PIN, verification };

    const { data: resolution, failure } = await createBankResolution({ userId, bankId, accountNumber });
    if (!resolution) return { data: null, failure, verification };
    if (!resolution.nameMatches) return { data: null, failure: ACTION_FAILURE.NAME_MISMATCH, verification };

    const bank = await selectBankName({ bankId });
    const saved = await withTransaction(async (trx) => {
        const primary = await selectPrimaryBankAccount({ trx, userId });
        const account = await insertBankAccount({
            trx,
            userId,
            bankId,
            accountNumber,
            accountName: resolution.accountName,
            isPrimary: !primary,
            verifiedAt: new Date(),
        });
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.BANK_ACCOUNT_ADDED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.USER_BANK_ACCOUNT,
            entityId: account.id,
            ipAddress,
            userAgent,
            metadata: { bankId, accountNumber: maskAccountNumber({ accountNumber }) },
        });
        return account;
    });

    const data = {
        id: saved.id,
        bankId,
        bankName: bank.name,
        accountNumber: maskAccountNumber({ accountNumber: saved.accountNumber }),
        accountName: saved.accountName,
        isPrimary: saved.isPrimary,
        verifiedAt: saved.verifiedAt,
    };
    return { data, failure: null, verification };
};

export default createBankAccount;
