import { withTransaction } from "@/database";
import providerRegistry from "@/services/crypto/providerRegistry";
import createDepositCredit from "@/actions/depositCredit/createDepositCredit";
import fitsDecimals from "@/utils/money/fitsDecimals";
import monitoring from "@/utils/monitoring";
import selectWalletForDeposit from "./queries/selectWalletForDeposit";
import insertDepositIfMissing from "./queries/insertDepositIfMissing";
import selectDepositForUpdate from "./queries/selectDepositForUpdate";
import updateDepositProgress from "./queries/updateDepositProgress";
import { DEPOSIT_FLAG_REASON, DEPOSIT_STATUS, SYNC_OUTCOME, SyncOutcome } from "@/constants/cryptoStatus";

export type { SyncOutcome };

/**
 * Brings one deposit in line with the provider's OWN record (fetched here,
 * never taken from a webhook body). Safe to call any number of times: the
 * row lock + terminal-state check make crediting happen exactly once.
 */
const syncDeposit = async ({ provider, reference }: { provider: string; reference: string }) => {
    const record = await providerRegistry.get({ name: provider }).getDeposit({ reference });
    if (!record) throw new Error(`Deposit ${reference} not found at ${provider}`);

    const wallet = await selectWalletForDeposit({ provider, address: record.address, providerCode: record.providerCode });
    if (!wallet) {
        monitoring.info(`Deposit ${reference} (${provider}) is not to one of our wallets — ignored`);
        return { data: { outcome: SYNC_OUTCOME.IGNORED } };
    }
    if (!fitsDecimals({ value: record.cryptoAmount, decimals: wallet.decimals })) {
        throw new Error(`Deposit ${reference}: amount exceeds ${wallet.symbol} precision — manual review`);
    }

    const outcome = await withTransaction(async (trx): Promise<SyncOutcome> => {
        await insertDepositIfMissing({
            trx,
            provider,
            reference,
            walletId: wallet.walletId,
            userId: wallet.userId,
            assetId: wallet.assetId,
            cryptoAmount: record.cryptoAmount,
        });
        const deposit = await selectDepositForUpdate({ trx, provider, reference });

        if (deposit.status === DEPOSIT_STATUS.COMPLETED || deposit.status === DEPOSIT_STATUS.DELETED) return SYNC_OUTCOME.UNCHANGED;
        if (deposit.lastEventAt && record.occurredAt < deposit.lastEventAt) return SYNC_OUTCOME.UNCHANGED;

        // Completed but settled in another currency: nothing safe to credit. Flag it once
        // (one alert, ops reviews it) instead of failing on every webhook and reconcile run.
        if (record.status === DEPOSIT_STATUS.COMPLETED && record.grossNgn === null) {
            if (deposit.status === DEPOSIT_STATUS.FLAGGED && deposit.subStatus === DEPOSIT_FLAG_REASON.NOT_SETTLED_IN_NGN) return SYNC_OUTCOME.UNCHANGED;
            await updateDepositProgress({ trx, id: deposit.id, record: { ...record, status: DEPOSIT_STATUS.FLAGGED, subStatus: DEPOSIT_FLAG_REASON.NOT_SETTLED_IN_NGN } });
            monitoring.error(`Deposit ${reference} (${provider}) settled without a naira amount — flagged for review, not credited`, new Error("deposit not settled in NGN"));
            return SYNC_OUTCOME.UPDATED;
        }

        if (record.status === DEPOSIT_STATUS.COMPLETED) {
            await createDepositCredit({ trx, provider, depositId: deposit.id, record, wallet });
            return SYNC_OUTCOME.CREDITED;
        }

        await updateDepositProgress({ trx, id: deposit.id, record });
        return SYNC_OUTCOME.UPDATED;
    });

    return { data: { outcome } };
};

export default syncDeposit;
