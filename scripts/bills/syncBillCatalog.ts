import { db } from "../../src/database";
import { BillProvider } from "../../src/services/bills/billProvider";
import { BILL_AMOUNT_TYPE, BILL_RANGE_DEFAULTS, BILLER_LINK_STATUS, BillCategory } from "../../src/constants/bills";
import inferBillCategory from "../../src/services/bills/catalog/inferBillCategory";
import matchProviderBiller from "../../src/services/bills/catalog/matchProviderBiller";
import cleanBillProductName from "../../src/services/bills/catalog/cleanBillProductName";
import parseValidityDays from "../../src/services/bills/catalog/parseValidityDays";

/**
 * Pulls a provider's catalog and records it, for ANY provider:
 *  - every provider biller → biller_provider_refs. New ones get a SUGGESTED
 *    link (keyword match); reviewed ones (confirmed/ignored) are never changed.
 *  - every product → bill_products, with a cleaned name. display_name,
 *    service_fee and is_enabled are ours and are never overwritten
 *    (is_enabled is only set on first insert: off for a duplicate).
 *  - anything missing from this catalog → is_available = false.
 * One transaction: a failed sync changes nothing.
 */
const syncBillCatalog = async ({ provider }: { provider: BillProvider }) => {
    const catalog = await provider.listCatalog();
    const { environment } = provider;
    const now = new Date();

    const summary = await db.transaction().execute(async (trx) => {
        const billers = await trx.selectFrom("billers").select(["id", "slug", "categoryCode", "matchKeywords"]).execute();
        const billerById = new Map(billers.map((biller) => [biller.id, biller]));

        const refs = new Map<string, { id: string; category: BillCategory | null; keywords: string[] }>();
        for (const providerBiller of catalog.billers) {
            const category = providerBiller.categoryHint ?? inferBillCategory({ name: providerBiller.name, customerIdLabel: providerBiller.customerIdLabel });
            const suggestion = matchProviderBiller({ name: providerBiller.name, category, billers });
            const raw = {
                providerName: providerBiller.name,
                providerCategory: category,
                providerCustomerIdLabel: providerBiller.customerIdLabel,
                providerLogoUrl: providerBiller.logoUrl,
                isAvailable: true,
                syncedAt: now,
                updatedAt: now,
            };

            const existing = await trx
                .selectFrom("biller_provider_refs")
                .select(["id", "status", "billerId"])
                .where("provider", "=", provider.name)
                .where("environment", "=", environment)
                .where("providerBillerRef", "=", providerBiller.providerBillerRef)
                .executeTakeFirst();

            let row: { id: string; billerId: string | null };
            if (!existing) {
                row = await trx
                    .insertInto("biller_provider_refs")
                    .values({
                        ...raw,
                        provider: provider.name,
                        environment,
                        providerBillerRef: providerBiller.providerBillerRef,
                        status: BILLER_LINK_STATUS.SUGGESTED,
                        billerId: suggestion.billerId,
                        matchReason: suggestion.reason,
                    })
                    .returning(["id", "billerId"])
                    .executeTakeFirstOrThrow();
            } else if (existing.status === BILLER_LINK_STATUS.SUGGESTED) {
                // Not reviewed yet: refresh the guess too (keywords may have been improved).
                row = await trx
                    .updateTable("biller_provider_refs")
                    .set({ ...raw, billerId: suggestion.billerId, matchReason: suggestion.reason })
                    .where("id", "=", existing.id)
                    .returning(["id", "billerId"])
                    .executeTakeFirstOrThrow();
            } else {
                row = await trx
                    .updateTable("biller_provider_refs")
                    .set(raw)
                    .where("id", "=", existing.id)
                    .returning(["id", "billerId"])
                    .executeTakeFirstOrThrow();
            }

            const linked = row.billerId ? billerById.get(row.billerId) : undefined;
            refs.set(providerBiller.providerBillerRef, {
                id: row.id,
                category: (linked?.categoryCode as BillCategory | undefined) ?? category,
                keywords: linked?.matchKeywords ?? [],
            });
        }

        await trx
            .updateTable("biller_provider_refs")
            .set({ isAvailable: false, updatedAt: now })
            .where("provider", "=", provider.name)
            .where("environment", "=", environment)
            .where("syncedAt", "<", now)
            .execute();

        const seenNames = new Set<string>();
        let duplicates = 0;
        let written = 0;
        for (const product of catalog.products) {
            const ref = refs.get(product.providerBillerRef);
            if (!ref) continue;

            const name = cleanBillProductName({ rawName: product.name, category: ref.category, amountType: product.amountType, billerKeywords: ref.keywords });
            const defaults = ref.category ? BILL_RANGE_DEFAULTS[ref.category] : null;
            const isRange = product.amountType === BILL_AMOUNT_TYPE.RANGE;
            const minAmount = isRange ? (product.minAmount ?? defaults?.min ?? null) : null;
            const maxAmount = isRange ? (product.maxAmount ?? defaults?.max ?? null) : null;
            if (isRange && (!minAmount || !maxAmount)) continue; // no category and no limits: can't be sold safely

            const dedupeKey = [ref.id, name.toLowerCase(), product.amountType, product.price ?? ""].join("|");
            const isDuplicate = seenNames.has(dedupeKey);
            seenNames.add(dedupeKey);
            if (isDuplicate) duplicates += 1;

            const values = {
                billerProviderRefId: ref.id,
                providerName: product.name,
                name,
                amountType: product.amountType,
                currency: product.currency,
                price: product.price,
                minAmount,
                maxAmount,
                providerFee: product.providerFee ?? "0.00",
                validityDays: product.validityDays ?? parseValidityDays({ name: product.name }),
                isAvailable: true,
                syncedAt: now,
                updatedAt: now,
            };
            await trx
                .insertInto("bill_products")
                .values({
                    ...values,
                    provider: provider.name,
                    environment,
                    providerProductRef: product.providerProductRef,
                    serviceFee: "0.00",
                    isEnabled: !isDuplicate,
                })
                .onConflict((oc) => oc.columns(["provider", "environment", "providerProductRef"]).doUpdateSet(values))
                .execute();
            written += 1;
        }

        await trx
            .updateTable("bill_products")
            .set({ isAvailable: false, updatedAt: now })
            .where("provider", "=", provider.name)
            .where("environment", "=", environment)
            .where("syncedAt", "<", now)
            .execute();

        const links = await trx
            .selectFrom("biller_provider_refs")
            .select(["status", "billerId"])
            .where("provider", "=", provider.name)
            .where("environment", "=", environment)
            .where("isAvailable", "=", true)
            .execute();

        return {
            billers: catalog.billers.length,
            confirmed: links.filter((link) => link.status === BILLER_LINK_STATUS.CONFIRMED).length,
            suggested: links.filter((link) => link.status === BILLER_LINK_STATUS.SUGGESTED && link.billerId).length,
            unmatched: links.filter((link) => link.status === BILLER_LINK_STATUS.SUGGESTED && !link.billerId).length,
            ignored: links.filter((link) => link.status === BILLER_LINK_STATUS.IGNORED).length,
            products: written,
            duplicates,
        };
    });

    console.log(`  ✓ ${summary.billers} provider billers: ${summary.confirmed} confirmed, ${summary.suggested} suggested, ${summary.unmatched} unmatched, ${summary.ignored} ignored`);
    console.log(`  ✓ ${summary.products} products (${summary.duplicates} duplicates disabled)`);
    if (summary.suggested + summary.unmatched > 0) console.log("  → Review links: npm run bills:review");
};

export default syncBillCatalog;
