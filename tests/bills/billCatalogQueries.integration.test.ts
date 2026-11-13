/**
 * Real-Postgres check of what the app can see in the bill catalog (skipped by default).
 * Run against a DISPOSABLE, fully migrated database:
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/bills/billCatalogQueries.integration.test.ts
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import selectBillCategories from "@/actions/billCategories/fetchBillCategories/queries/selectBillCategories";
import selectBillers from "@/actions/billers/fetchBillers/queries/selectBillers";
import selectBillProducts from "@/actions/billProducts/fetchBillProducts/queries/selectBillProducts";
import selectListableBiller from "@/schemaHelpers/selectListableBiller";
import selectListableBillProduct from "@/schemaHelpers/selectListableBillProduct";

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("bill catalog listing against Postgres", () => {
    const tag = randomUUID().slice(0, 6);
    const provider = `fb${tag}`;
    const other = `ob${tag}`;
    const environment = "sandbox";
    const ids: Record<string, string> = {};

    const billerId = async (slug: string) =>
        (await db.selectFrom("billers").select(["id"]).where("slug", "=", slug).executeTakeFirstOrThrow()).id;

    const addRef = async (key: string, values: { billerSlug: string | null; status: string; provider?: string; isAvailable?: boolean }) => {
        const row = await db
            .insertInto("biller_provider_refs")
            .values({
                billerId: values.billerSlug ? await billerId(values.billerSlug) : null,
                provider: values.provider ?? provider,
                environment,
                providerBillerRef: `${key}-${tag}`,
                providerName: key,
                status: values.status,
                isAvailable: values.isAvailable ?? true,
                reviewedAt: values.status === "suggested" ? null : new Date(),
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();
        ids[key] = row.id;
    };

    const addProduct = async (key: string, refKey: string, values: { name: string; price?: string; displayName?: string; isEnabled?: boolean; isAvailable?: boolean; provider?: string }) => {
        const row = await db
            .insertInto("bill_products")
            .values({
                billerProviderRefId: ids[refKey],
                provider: values.provider ?? provider,
                environment,
                providerProductRef: `${key}-${tag}`,
                providerName: values.name.toUpperCase(),
                name: values.name,
                displayName: values.displayName ?? null,
                amountType: values.price ? "fixed" : "range",
                currency: "NGN",
                price: values.price ?? null,
                minAmount: values.price ? null : "50.00",
                maxAmount: values.price ? null : "50000.00",
                serviceFee: "0.00",
                providerFee: "0.00",
                isEnabled: values.isEnabled ?? true,
                isAvailable: values.isAvailable ?? true,
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();
        ids[key] = row.id;
    };

    beforeAll(async () => {
        await addRef("mtnData", { billerSlug: "mtn-data", status: "confirmed" });
        await addProduct("gb2", "mtnData", { name: "2GB", price: "2000.00" });
        await addProduct("gb1", "mtnData", { name: "1GB", price: "1000.00", displayName: "1GB (30 days)" });
        await addProduct("disabled", "mtnData", { name: "Dup 1GB", price: "1000.00", isEnabled: false });
        await addProduct("gone", "mtnData", { name: "Old 5GB", price: "5000.00", isAvailable: false });

        await addRef("ikeja", { billerSlug: "ikeja-electric", status: "suggested" }); // not reviewed yet
        await addProduct("prepaid", "ikeja", { name: "Prepaid" });

        await addRef("dstvOther", { billerSlug: "dstv", status: "confirmed", provider: other }); // another provider
        await addProduct("premium", "dstvOther", { name: "Premium", price: "14600.00", provider: other });

        await addRef("glo", { billerSlug: "glo-airtime", status: "confirmed", isAvailable: false }); // dropped by provider
        await addProduct("gloAirtime", "glo", { name: "Airtime" });

        await addRef("firs", { billerSlug: null, status: "ignored" });
    });

    afterAll(async () => {
        await disconnect();
    });

    it("lists only categories with something sellable from this provider", async () => {
        const categories = await selectBillCategories({ provider, environment });
        expect(categories).toEqual([{ code: "data", name: "Data" }]);
    });

    it("lists only billers with a confirmed, available link and a sellable product", async () => {
        const billers = await selectBillers({ provider, environment });
        expect(billers.map((biller) => biller.name)).toEqual(["MTN"]);
        expect(billers[0]).toMatchObject({ category: "data", customerIdLabel: "Phone number", requiresValidation: false });

        expect(await selectBillers({ provider, environment, category: "electricity" })).toEqual([]);
        expect((await selectBillers({ provider: other, environment, category: "cable_tv" })).map((biller) => biller.name)).toEqual(["DStv"]);
    });

    it("lists enabled, available products by price, preferring our display name", async () => {
        const products = await selectBillProducts({ billerId: await billerId("mtn-data"), provider, environment });
        expect(products.map((product) => [product.name, product.price, product.serviceFee])).toEqual([
            ["1GB (30 days)", "1000.00", "0.00"],
            ["2GB", "2000.00", "0.00"],
        ]);
    });

    it("guards single lookups with the same rules", async () => {
        expect(await selectListableBiller({ billerId: await billerId("mtn-data"), provider, environment })).toBeTruthy();
        expect(await selectListableBiller({ billerId: await billerId("ikeja-electric"), provider, environment })).toBeUndefined();
        expect(await selectListableBiller({ billerId: await billerId("dstv"), provider, environment })).toBeUndefined();

        expect(await selectListableBillProduct({ productId: ids.gb1, provider, environment })).toEqual({
            id: ids.gb1, amountType: "fixed", currency: "NGN", price: "1000.00", minAmount: null, maxAmount: null,
            customerIdLabel: "Phone number", customerIdPattern: "^0[789][01][0-9]{8}$",
        });
        for (const key of ["disabled", "gone", "prepaid", "gloAirtime"]) {
            expect(await selectListableBillProduct({ productId: ids[key], provider, environment })).toBeUndefined();
        }
        expect(await selectListableBillProduct({ productId: ids.premium, provider, environment })).toBeUndefined();
    });
});
