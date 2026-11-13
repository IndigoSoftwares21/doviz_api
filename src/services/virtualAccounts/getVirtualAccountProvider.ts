import { VirtualAccountProvider } from "./virtualAccountProvider";
import SquadClient from "./providers/squad/squadClient";
import SquadVirtualAccountProvider from "./providers/squad/squadVirtualAccountProvider";
import FossapayClient from "./providers/fossapay/fossapayClient";
import FossapayVirtualAccountProvider from "./providers/fossapay/fossapayVirtualAccountProvider";

const SQUAD_URL = { sandbox: "https://sandbox-api-d.squadco.com", production: "https://api-d.squadco.com" } as const;

/**
 * Every provider that can issue account numbers, by name. Adding one = an
 * adapter + an entry here; which is used is the `naira_funding` setting
 * (`npm run funding:use -- <name>`). A factory throws if it isn't configured.
 */
const FACTORIES: Record<string, () => VirtualAccountProvider> = {
    squad: () => {
        const key = process.env.SQUAD_SECRET_KEY;
        if (!key) throw new Error("SQUAD_SECRET_KEY is not set");
        const environment = key.startsWith("sandbox_") ? "sandbox" : "production";
        const client = new SquadClient(key, process.env.SQUAD_BASE_URL || SQUAD_URL[environment]);
        return new SquadVirtualAccountProvider(client, environment, process.env.SQUAD_SETTLEMENT_ACCOUNT || null, key);
    },
    fossapay: () => {
        const key = process.env.FOSSAPAY_API_KEY;
        const fallbackEmail = process.env.VIRTUAL_ACCOUNT_FALLBACK_EMAIL;
        if (!key) throw new Error("FOSSAPAY_API_KEY is not set");
        if (!fallbackEmail) throw new Error("VIRTUAL_ACCOUNT_FALLBACK_EMAIL is not set (Fossapay needs a unique email per customer)");
        return new FossapayVirtualAccountProvider(new FossapayClient(key), fallbackEmail, process.env.FOSSAPAY_COUNTRY || "Nigeria", {
            webhookSecret: process.env.FOSSAPAY_WEBHOOK_SECRET || null,
            amountUnit: process.env.FOSSAPAY_AMOUNT_UNIT === "kobo" ? "kobo" : "naira",
        });
    },
};

const built = new Map<string, VirtualAccountProvider>();

/** The named account-number provider (built once). Throws for an unknown or unconfigured one. */
const getVirtualAccountProvider = ({ name }: { name: string }): VirtualAccountProvider => {
    const existing = built.get(name);
    if (existing) return existing;
    const factory = FACTORIES[name];
    if (!factory) throw new Error(`No account-number provider named "${name}"`);
    const provider = factory();
    built.set(name, provider);
    return provider;
};

/** The named provider if it exists AND is configured, else null — for routing its webhooks. */
export const findVirtualAccountProvider = ({ name }: { name: string }): VirtualAccountProvider | null => {
    if (!built.has(name) && !FACTORIES[name]) return null;
    try {
        return getVirtualAccountProvider({ name });
    } catch {
        return null;
    }
};

/** Tests only: use `provider` for its name, or clear everything. */
export const setVirtualAccountProvider = (provider: VirtualAccountProvider | null) => {
    if (provider) built.set(provider.name, provider);
    else built.clear();
};

export default getVirtualAccountProvider;
