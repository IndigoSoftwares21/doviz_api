// scripts/mock-crypto-deposit.ts — npm run crypto:mock-deposit -- <address> <amountInUSD> [cryptoAmount]
import * as dotenv from "dotenv";
dotenv.config();

import { randomUUID } from "crypto";
import { db, disconnect } from "../src/database";
import { PROVIDER_ENVIRONMENT } from "../src/constants/crypto";
import BreetClient from "../src/services/crypto/providers/breet/breetClient";
import BREET from "../src/services/crypto/providers/breet/constants";

const STABLECOINS = ["USDT", "USDC"];

/**
 * SANDBOX ONLY. Asks Breet to fake an incoming deposit to one of our
 * addresses (POST /trades/sell/mock-trade). Breet then runs the real flow —
 * trade.pending → trade.completed webhooks → our sync → naira credited —
 * so this exercises everything end to end without real coins.
 */
const main = async () => {
    const [address, amountInUSD, cryptoArg] = process.argv.slice(2);
    if (!address || !amountInUSD) {
        throw new Error("Usage: npm run crypto:mock-deposit -- <address> <amountInUSD> [cryptoAmount]");
    }
    if (!/^\d+(\.\d+)?$/.test(amountInUSD)) throw new Error("amountInUSD must be a positive number");

    const client = new BreetClient();
    if (client.environment !== PROVIDER_ENVIRONMENT.SANDBOX) {
        throw new Error("Refusing to mock a deposit outside the sandbox (BREET_ENV must be sandbox)");
    }

    const wallet = await db
        .selectFrom("crypto_wallets")
        .innerJoin("crypto_assets", "crypto_assets.id", "crypto_wallets.assetId")
        .innerJoin("crypto_provider_assets", (join) =>
            join
                .onRef("crypto_provider_assets.assetId", "=", "crypto_wallets.assetId")
                .onRef("crypto_provider_assets.provider", "=", "crypto_wallets.provider")
                .on("crypto_provider_assets.environment", "=", client.environment),
        )
        .select(["crypto_assets.symbol", "crypto_provider_assets.providerCode"])
        .where("crypto_wallets.address", "=", address)
        .where("crypto_wallets.provider", "=", BREET.PROVIDER_NAME)
        .executeTakeFirst();
    if (!wallet) throw new Error("No Breet sandbox address like that in our database — create it in the app first");

    const cryptoReceived = cryptoArg ?? (STABLECOINS.includes(wallet.symbol) ? amountInUSD : null);
    if (!cryptoReceived) throw new Error(`Pass the ${wallet.symbol} amount too, e.g. -- ${address} ${amountInUSD} 0.0001`);

    const body = {
        walletAddress: address,
        asset: wallet.providerCode,
        amountInUSD: Number(amountInUSD),
        cryptoReceived: Number(cryptoReceived),
        reference: `mock-${randomUUID()}`,
        txHash: `0xmock${randomUUID().replace(/-/g, "")}`,
    };
    await client.request({ method: "POST", path: "/trades/sell/mock-trade", body });
    console.log(`Mocked ${cryptoReceived} ${wallet.symbol} ($${amountInUSD}) → ${address}`);
    console.log("Watch the API logs / ngrok panel for the trade.pending and trade.completed webhooks.");
};

main()
    .catch((error) => {
        console.error("Mock deposit failed:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
