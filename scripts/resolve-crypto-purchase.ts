// scripts/resolve-crypto-purchase.ts — npm run crypto-purchases:resolve -- <purchaseId> sent|refund [--tx <hash>] [--note "…"]
// Ops decision for a purchase in needs_review, AFTER checking the provider's own history:
//   sent   — the coin left (settles it; --tx records the hash)
//   refund — the provider confirms nothing was sent (returns the naira)
import * as dotenv from "dotenv";
dotenv.config();

import { db, disconnect } from "../src/database";
import createCryptoPurchaseSettlement from "../src/actions/cryptoPurchaseSettlement/createCryptoPurchaseSettlement";
import createCryptoPurchaseRefund from "../src/actions/cryptoPurchaseRefund/createCryptoPurchaseRefund";
import parseFlags from "./crypto-buy/parseFlags";
import { CRYPTO_PURCHASE_STATUS, PROVIDER_SEND_STATUS } from "../src/constants/cryptoPurchases";

const USAGE = "Usage: npm run crypto-purchases:resolve -- <purchaseId> sent|refund [--tx <hash>]";
const REFUND_REASON = "Your crypto couldn't be sent. Your naira has been returned.";

const main = async () => {
    const { positional, flags } = parseFlags(process.argv.slice(2));
    const [purchaseId, decision] = positional;
    if (!purchaseId || (decision !== "sent" && decision !== "refund")) throw new Error(USAGE);

    const purchase = await db.selectFrom("crypto_purchases").select(["id", "status", "providerReference"]).where("id", "=", purchaseId).executeTakeFirst();
    if (!purchase) throw new Error(`No purchase ${purchaseId}`);
    if (purchase.status !== CRYPTO_PURCHASE_STATUS.NEEDS_REVIEW) throw new Error(`Purchase is ${purchase.status}; only needs_review purchases are resolved by hand`);

    await db.transaction().execute(async (trx) => {
        if (decision === "refund") {
            await createCryptoPurchaseRefund({ trx, purchaseId, reason: REFUND_REASON, byOps: true });
            console.log(`Refunded ${purchaseId}`);
            return;
        }
        const txHash = typeof flags.tx === "string" ? flags.tx : null;
        const record = { externalId: purchaseId, providerReference: purchase.providerReference, status: PROVIDER_SEND_STATUS.COMPLETED, amount: null, fee: null, txHash, failureReason: null };
        await createCryptoPurchaseSettlement({ trx, purchaseId, record, byOps: true });
        console.log(`Marked ${purchaseId} as sent${txHash ? ` (${txHash})` : ""}`);
    });
};

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
