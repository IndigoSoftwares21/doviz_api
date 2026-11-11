import Decimal from "decimal.js";
import { withTransaction } from "@/database";
import createLedgerPosting from "@/actions/ledger/createLedgerPosting";
import ensureLedgerAccount from "@/actions/ledger/createLedgerPosting/queries/ensureLedgerAccount";
import fetchTransferLimits from "@/actions/transferLimits/fetchTransferLimits";
import transferLimitProblem from "@/utils/transfers/transferLimitProblem";
import displayName from "@/utils/transfers/displayName";
import lockLedgerAccounts from "../../queries/lockLedgerAccounts";
import selectTransferParties from "../../queries/selectTransferParties";
import insertInternalTransfer from "../../queries/insertInternalTransfer";
import recordTransferEvents from "../recordTransferEvents";
import TRANSFERS from "@/constants/transfers";
import USER from "@/constants/user";
import ACTION_FAILURE from "@/constants/actionFailure";
import { LEDGER_ACCOUNT_KIND, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

export interface ICompleteTransfer {
    id: string;
    senderId: string;
    recipientId: string;
    amount: string;
    note: string | null;
    idempotencyKey: string;
    ipAddress: string | null;
    userAgent: string | null;
}

type Outcome = { failure: null } | { failure: string; message?: string };

/**
 * ONE transaction, so it all happens or none of it does: lock both balances
 * (id order) → re-check both people → the daily cap, under the sender's lock →
 * move the money (the ledger refuses an overdraft: throws, caller → 402) →
 * record → audit both sides → push to both, delivered only on commit.
 */
const completeTransfer = (input: ICompleteTransfer) =>
    withTransaction(async (trx): Promise<Outcome> => {
        const { id, senderId, recipientId, amount } = input;
        if (senderId === recipientId) return { failure: ACTION_FAILURE.RECIPIENT_UNAVAILABLE };
        const currency = TRANSFERS.CURRENCY;
        const account = (userId: string) => ensureLedgerAccount({ trx, account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId }, currency });
        const sender = await account(senderId);
        const recipient = await account(recipientId);
        await lockLedgerAccounts({ trx, accountIds: [sender.id, recipient.id] });

        const parties = await selectTransferParties({ trx, userIds: [senderId, recipientId] });
        const from = parties.find((party) => party.id === senderId);
        const to = parties.find((party) => party.id === recipientId);
        if (from?.status !== USER.STATUS_ACTIVE) return { failure: ACTION_FAILURE.ACCOUNT_INACTIVE };
        if (!to || to.status !== USER.STATUS_ACTIVE || !to.tag || !to.firstName || !to.lastName) return { failure: ACTION_FAILURE.RECIPIENT_UNAVAILABLE };

        const { data: limits } = await fetchTransferLimits({ userId: senderId, trx });
        const problem = transferLimitProblem({ amount, limits, sentToday: limits.sentToday });
        if (problem) return { failure: ACTION_FAILURE.TRANSFER_LIMIT, message: problem };

        const value = new Decimal(amount).toFixed(2);
        const { data: posting } = await createLedgerPosting({
            trx,
            idempotencyKey: `internal-transfer:${id}`,
            type: LEDGER_TRANSACTION_TYPE.INTERNAL_TRANSFER,
            description: `Ziks transfer ${from.tag ? `@${from.tag}` : displayName(from)} → @${to.tag}`.slice(0, 255),
            currency,
            metadata: { internalTransferId: id, senderId, recipientId },
            entries: [
                { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: senderId }, amount: `-${value}` },
                { account: { kind: LEDGER_ACCOUNT_KIND.USER_AVAILABLE, userId: recipientId }, amount: value },
            ],
        });

        await insertInternalTransfer({
            trx, id, senderId, recipientId, senderTag: from.tag, recipientTag: to.tag, amount: value, currency,
            note: input.note, idempotencyKey: input.idempotencyKey, ledgerTransactionId: posting.transactionId,
        });
        await recordTransferEvents({ trx, input, amount: value, senderTag: from.tag });

        return { failure: null };
    });

export default completeTransfer;
