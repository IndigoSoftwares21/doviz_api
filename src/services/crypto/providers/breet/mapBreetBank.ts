import { ProviderBank } from "../../types";
import { BreetBank } from "./breetTypes";
import toBankSlug from "@/utils/banks/toBankSlug";

/** Breet's bank list has its own id and a slug, but no CBN/NIP code. */
const mapBreetBank = ({ bank }: { bank: BreetBank }): ProviderBank => ({
    providerBankId: String(bank.id),
    name: bank.name.trim(),
    slug: toBankSlug({ value: bank.slug ?? bank.name }),
    code: null,
});

export default mapBreetBank;
