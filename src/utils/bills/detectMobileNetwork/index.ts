import { MOBILE_NETWORKS } from "@/constants/bills";

/**
 * The network that issued a local Nigerian number ("08126257120" → Airtel),
 * by prefix, longest prefix first. null for prefixes we don't know (other
 * operators, new ranges). Never certain: ported numbers keep their prefix.
 */
const detectMobileNetwork = ({ phone }: { phone: string }) => {
    const candidates = MOBILE_NETWORKS.flatMap((network) => network.prefixes.map((prefix) => ({ prefix, network })));
    const match = candidates.sort((a, b) => b.prefix.length - a.prefix.length).find(({ prefix }) => phone.startsWith(prefix));

    return match ? { code: match.network.code, name: match.network.name } : null;
};

export default detectMobileNetwork;
