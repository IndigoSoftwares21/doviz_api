import monitoring from "@/utils/monitoring";
import BreetClient from "./breetClient";
import { BreetWallet } from "./breetTypes";
import BREET from "./constants";
import matchesBreetLabel from "./matchesBreetLabel";

/**
 * Breet has no label filter, so page through the wallet list (capped).
 * Matches our label (Breet adds a merchant prefix) AND the asset.
 */
const findBreetWalletByLabel = async ({
    client,
    providerCode,
    label,
}: {
    client: BreetClient;
    providerCode: string;
    label: string;
}) => {
    for (let page = 1; page <= BREET.MAX_PAGES; page++) {
        const wallets = await client.request<BreetWallet[]>({
            method: "GET",
            path: "/trades/wallets",
            params: { page, size: BREET.PAGE_SIZE },
        });

        const match = (wallets ?? []).find(
            (wallet) =>
                matchesBreetLabel({ breetLabel: wallet.label, label }) &&
                (wallet.identifier === providerCode || wallet.asset === providerCode),
        );
        if (match) return { providerWalletId: match.id, address: match.address };
        if (!wallets || wallets.length < BREET.PAGE_SIZE) return null;
    }

    monitoring.warn(`Breet wallet search for label ${label} stopped after ${BREET.MAX_PAGES} pages`);
    return null;
};

export default findBreetWalletByLabel;
