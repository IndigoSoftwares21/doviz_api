import { withTransaction } from "@/database";
import AUDIT_ACTIONS from "@/constants/auditActions";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import updateWalletActive from "../../queries/updateWalletActive";
import updateUnsetPrimaryWallets from "../../queries/updateUnsetPrimaryWallets";
import updateSetPrimaryWallet from "../../queries/updateSetPrimaryWallet";
import { AUDIT_ACTOR_TYPE, AUDIT_ENTITY_TYPE } from "@/constants/auditTargets";

interface IActivateWallet {
    walletId: string;
    userId: string;
    assetId: string;
    address: string;
    providerWalletId: string;
    audit: { provider: string; symbol: string; network: string; ipAddress: string | null; userAgent: string | null };
}

/** Saves the issued address and makes it the user's primary for the coin — one short transaction. */
const activateWallet = ({ walletId, userId, assetId, address, providerWalletId, audit }: IActivateWallet) => {
    return withTransaction(async (trx) => {
        await updateWalletActive({ trx, id: walletId, address, providerWalletId, activatedAt: new Date() });
        await updateUnsetPrimaryWallets({ trx, userId, assetId, exceptId: walletId });
        await updateSetPrimaryWallet({ trx, id: walletId });
        await createAuditLog({
            trx,
            action: AUDIT_ACTIONS.CRYPTO_WALLET_CREATED,
            actorType: AUDIT_ACTOR_TYPE.USER,
            actorId: userId,
            entityType: AUDIT_ENTITY_TYPE.CRYPTO_WALLET,
            entityId: walletId,
            ipAddress: audit.ipAddress,
            userAgent: audit.userAgent,
            metadata: { symbol: audit.symbol, network: audit.network, provider: audit.provider },
        });
    });
};

export default activateWallet;
