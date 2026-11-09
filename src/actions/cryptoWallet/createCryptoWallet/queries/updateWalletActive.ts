import { Kysely } from "kysely";
import { Database } from "@/database/types";
import { WALLET_STATUS } from "@/constants/cryptoStatus";

interface IUpdateWalletActive {
    trx: Kysely<Database>;
    id: string;
    address: string;
    providerWalletId: string;
    activatedAt: Date;
}

const updateWalletActive = async ({ trx, id, address, providerWalletId, activatedAt }: IUpdateWalletActive) => {
    const walletRow = await trx
        .updateTable("crypto_wallets")
        .set({ status: WALLET_STATUS.ACTIVE, address, providerWalletId, activatedAt, updatedAt: activatedAt })
        .where("id", "=", id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

    return walletRow;
};

export default updateWalletActive;
