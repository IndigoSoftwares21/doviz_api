import billProviderRegistry from "@/services/bills/billProviderRegistry";
import { makeFakeBillProvider } from "./fakeBillProvider";

describe("billProviderRegistry", () => {
    const originalProvider = process.env.BILLS_PROVIDER;

    afterEach(() => {
        billProviderRegistry.reset();
        if (originalProvider === undefined) delete process.env.BILLS_PROVIDER;
        else process.env.BILLS_PROVIDER = originalProvider;
    });

    it("returns the provider named by BILLS_PROVIDER as active", () => {
        const first = makeFakeBillProvider({ name: "firstbills" });
        const second = makeFakeBillProvider({ name: "secondbills" });
        billProviderRegistry.register(first);
        billProviderRegistry.register(second);

        process.env.BILLS_PROVIDER = "secondbills";
        expect(billProviderRegistry.active()).toBe(second);

        // A switch is only an env change; the old provider stays reachable for in-flight payments.
        process.env.BILLS_PROVIDER = "firstbills";
        expect(billProviderRegistry.active()).toBe(first);
        expect(billProviderRegistry.get({ name: "secondbills" })).toBe(second);
    });

    it("falls back to the default provider when BILLS_PROVIDER is unset", () => {
        delete process.env.BILLS_PROVIDER;
        const flutterwave = makeFakeBillProvider({ name: "flutterwave" });
        billProviderRegistry.register(flutterwave);

        expect(billProviderRegistry.active()).toBe(flutterwave);
    });

    it("throws for a provider that isn't registered", () => {
        expect(billProviderRegistry.has({ name: "nobody" })).toBe(false);
        expect(() => billProviderRegistry.get({ name: "nobody" })).toThrow('Bill provider "nobody" is not registered');
    });
});
