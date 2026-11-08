import { withTransaction } from "@/database";
import AUTH from "@/constants/auth";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import verifyPinHash from "@/utils/auth/verifyPinHash";
import selectTransactionPinForUpdate from "./queries/selectTransactionPinForUpdate";
import updatePinAttempts from "./queries/updatePinAttempts";

export type PinVerification =
    | { status: "verified" }
    | { status: "invalid"; remainingAttempts: number }
    | { status: "locked"; lockedUntil: Date }
    | { status: "not_set" };

interface ICreatePinVerification {
    userId: string;
    pin: string;
    ipAddress: string | null;
    userAgent: string | null;
}

// Reusable PIN check for any sensitive action (transfers, enabling
// biometrics, changing the PIN). Runs in its own transaction so a failed
// attempt is always committed, even when the caller's action is aborted.
// PIN_MAX_ATTEMPTS consecutive failures lock the PIN for PIN_LOCK_SECONDS.
const createPinVerification = async ({
    userId,
    pin,
    ipAddress,
    userAgent,
}: ICreatePinVerification) => {
    const data = await withTransaction(async (trx): Promise<PinVerification> => {
        const now = new Date();

        const pinRow = await selectTransactionPinForUpdate({ trx, userId });

        if (!pinRow) {
            return { status: "not_set" };
        }

        if (pinRow.lockedUntil && pinRow.lockedUntil > now) {
            return { status: "locked", lockedUntil: pinRow.lockedUntil };
        }

        const isValid = await verifyPinHash({ userId, pin, pinHash: pinRow.pinHash });

        if (isValid) {
            if (pinRow.failedAttempts > 0 || pinRow.lockedUntil) {
                await updatePinAttempts({ trx, userId, failedAttempts: 0, lockedUntil: null });
            }

            return { status: "verified" };
        }

        const failedAttempts = pinRow.failedAttempts + 1;
        const isLocked = failedAttempts >= AUTH.PIN_MAX_ATTEMPTS;
        const lockedUntil = isLocked ? new Date(now.getTime() + AUTH.PIN_LOCK_SECONDS * 1000) : null;

        await updatePinAttempts({
            trx,
            userId,
            failedAttempts: isLocked ? 0 : failedAttempts,
            lockedUntil,
        });

        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.PIN_VERIFICATION_FAILED,
            actorType: "user",
            actorId: userId,
            ipAddress,
            userAgent,
            metadata: { failedAttempts },
        });

        if (lockedUntil) {
            await createAuditLog({
                trx,
                action: AUDIT_ACTIONS.PIN_LOCKED,
                actorType: "user",
                actorId: userId,
                ipAddress,
                userAgent,
                metadata: { lockedUntil: lockedUntil.toISOString() },
            });

            return { status: "locked", lockedUntil };
        }

        return { status: "invalid", remainingAttempts: AUTH.PIN_MAX_ATTEMPTS - failedAttempts };
    });

    return { data };
};

export default createPinVerification;
