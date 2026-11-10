import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { ProviderBankTransfer } from "@/services/collections/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import calculateNairaDepositCredit from "@/utils/nairaDeposits/calculateNairaDepositCredit";
import { REALTIME_EVENT } from "@/constants/realtime";
import selectNairaDepositForUpdate from "./queries/selectNairaDepositForUpdate";
import updateNairaDepositCompleted from "./queries/updateNairaDepositCompleted";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { FeeBearer, NAIRA_DEPOSIT_STATUS } from "@/constants/nairaDeposits";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

const FINAL: string[] = [NAIRA_DEPOSIT_STATUS.COMPLETED, NAIRA_DEPOSIT_STATUS.FAILED];

/**
 * Credits a transfer the provider confirmed, inside the caller's transaction:
 *   user_available        +credited
 *   provider_clearing     −settled   (received − provider fee: what reached Doviz)
 *   provider_fees         −absorbed  (only when Doviz bears the fee)
 * The amount is what the provider says it received — never the webhook body,
 * never what we asked for. The fee is the larger of the provider's reported
 * fee and the fee it quoted at creation (a lookup can omit the fee or its
 * VAT — under-counting it would credit the user the fee too). Does nothing if the deposit is already final; throws
 * rather than guess on a currency mismatch.
 */
const createNairaDepositCredit = async ({ trx, nairaDepositId, record }: { trx: Kysely<Database>; nairaDepositId: string; record: ProviderBankTransfer }) => {
    const deposit = await selectNairaDepositForUpdate({ trx, id: nairaDepositId });
    if (FINAL.includes(deposit.status)) return { data: { credited: false } };

    if (!record.amountPaid) throw new Error(`Naira deposit ${deposit.id}: provider confirmed it without an amount — manual review`);
    if (record.amountPaid.currency !== deposit.currency || (record.fee && record.fee.currency !== deposit.currency)) {
        throw new Error(`Naira deposit ${deposit.id}: provider reported ${record.amountPaid.currency}, deposit is ${deposit.currency} — manual review`);
    }

    const amountReceived = new Decimal(record.amountPaid.amount).toFixed(2);
    const providerFee = Decimal.max(record.fee?.amount ?? "0", deposit.fee ?? "0").toFixed(2);
    const { amountCredited, settled, absorbedFee } = calculateNairaDepositCredit({
        amountReceived,
        providerFee,
        feeBearer: deposit.feeBearer as FeeBearer,
    });

    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `naira-deposit:${deposit.id}`,
        type: LEDGER_TRANSACTION_TYPE.NAIRA_DEPOSIT,
        description: "Bank transfer deposit",
        currency: deposit.currency,
        metadata: { nairaDepositId: deposit.id, provider: deposit.provider, providerReference: record.providerReference, amountReceived, providerFee },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: deposit.userId }, amount: amountCredited },
            { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider: deposit.provider }, amount: new Decimal(settled).negated().toFixed(2) },
            ...(new Decimal(absorbedFee).isZero()
                ? []
                : [{ account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_FEES, provider: deposit.provider }, amount: new Decimal(absorbedFee).negated().toFixed(2) }]),
        ],
    });

    await updateNairaDepositCompleted({
        trx,
        id: deposit.id,
        providerReference: record.providerReference,
        amountReceived,
        providerFee,
        amountCredited,
        paidAt: record.paidAt ?? new Date(),
        ledgerTransactionId: posting.transactionId,
    });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.NAIRA_DEPOSIT_CREDITED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.NAIRA_DEPOSIT,
        entityId: deposit.id,
        metadata: { nairaDepositId: deposit.id, provider: deposit.provider, amountReceived, providerFee, amountCredited },
    });

    await publishUserEvent({ trx, userId: deposit.userId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });
    await publishUserEvent({ trx, userId: deposit.userId, event: REALTIME_EVENT.NAIRA_DEPOSIT_UPDATED, data: { nairaDepositId: deposit.id, status: NAIRA_DEPOSIT_STATUS.COMPLETED } });

    return { data: { credited: true } };
};

export default createNairaDepositCredit;
