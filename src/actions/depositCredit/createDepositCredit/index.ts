import Decimal from "decimal.js";
import { Kysely } from "kysely";
import { Database } from "@/database/types";
import CRYPTO from "@/constants/crypto";
import AUDIT_ACTIONS from "@/constants/auditActions";
import { ProviderDeposit } from "@/services/crypto/types";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import calculateMarkup from "@/utils/money/calculateMarkup";
import toKobo from "@/utils/money/toKobo";
import monitoring from "@/utils/monitoring";
import selectCurrentMarkup from "./queries/selectCurrentMarkup";
import updateDepositCompleted from "./queries/updateDepositCompleted";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface ICreateDepositCredit {
    trx: Kysely<Database>;
    provider: string;
    depositId: string;
    record: ProviderDeposit;
    wallet: { userId: string; assetId: string; symbol: string };
}

/**
 * Credits a completed deposit to the user's naira balance, minus Doviz's
 * markup, inside the caller's transaction (which holds the deposit row lock).
 * Throws — leaving the deposit uncredited for retry/review — rather than
 * guessing when anything is missing.
 */
const createDepositCredit = async ({ trx, provider, depositId, record, wallet }: ICreateDepositCredit) => {
    if (record.grossNgn === null) {
        throw new Error(`Deposit ${record.reference}: provider reported no naira amount — is the merchant wallet set to NGN?`);
    }
    const grossNgn = toKobo({ value: record.grossNgn });

    const markup = await selectCurrentMarkup({ trx, assetId: wallet.assetId, currency: CRYPTO.CURRENCY });
    if (!markup) {
        const error = new Error(`No conversion markup configured for ${wallet.symbol} — deposit ${record.reference} not credited`);
        monitoring.error(error.message, error);
        throw error;
    }

    const { markupNgn, netNgn } = calculateMarkup({ grossNgn, markupPercent: markup.markupPercent });
    if (!new Decimal(netNgn).greaterThan(0)) {
        throw new Error(`Deposit ${record.reference}: net naira is ${netNgn} — manual review`);
    }

    const { data: posting } = await createLedgerPosting({
        trx,
        idempotencyKey: `deposit:${provider}:${record.reference}`,
        type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT,
        description: `${wallet.symbol} deposit converted to naira`,
        metadata: { provider, reference: record.reference, depositId },
        entries: [
            { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: wallet.userId }, amount: netNgn },
            ...(new Decimal(markupNgn).isZero() ? [] : [{ account: { kind: LEDGER_ACCOUNT_KIND.MARKUP_REVENUE }, amount: markupNgn }]),
            { account: { kind: LEDGER_ACCOUNT_KIND.PROVIDER_CLEARING, provider }, amount: new Decimal(grossNgn).negated().toFixed(2) },
        ],
    });

    const figures = { grossNgn, markupNgn, netNgn, markupPercent: markup.markupPercent, conversionMarkupId: markup.id };
    await updateDepositCompleted({ trx, id: depositId, record, figures, ledgerTransactionId: posting.transactionId });

    await createAuditLog({
        trx,
        action: AUDIT_ACTIONS.CRYPTO_DEPOSIT_CREDITED,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        entityType: AUDIT_ENTITY_TYPE.CRYPTO_DEPOSIT,
        entityId: depositId,
        metadata: { depositId, netNgn, symbol: wallet.symbol },
    });

    return { data: { netNgn, markupNgn, grossNgn } };
};

export default createDepositCredit;
