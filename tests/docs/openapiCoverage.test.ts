import openApiSpec from "@/docs/openapi";
import appRoutes from "@/routes/app.routes";
import authRoutes from "@/routes/auth.routes";
import userRoutes from "@/routes/user.routes";
import cryptoRoutes from "@/routes/crypto.routes";
import walletRoutes from "@/routes/wallet.routes";
import bankRoutes from "@/routes/bank.routes";
import bankAccountRoutes from "@/routes/bankAccount.routes";
import billRoutes from "@/routes/bill.routes";
import nairaDepositRoutes from "@/routes/nairaDeposit.routes";

jest.mock("@/database", () => ({ db: {}, disconnect: jest.fn(), withTransaction: jest.fn() }));

describe("OpenAPI spec coverage", () => {
    const documented = Object.entries(openApiSpec.paths).flatMap(([path, operations]) =>
        Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`),
    );

    type Layer = { route?: { path: string; methods: Record<string, boolean> } };
    const routesOf = (router: { stack: Layer[] }, prefix: string) =>
        router.stack
            .filter((layer) => layer.route)
            .flatMap((layer) =>
                Object.keys(layer.route!.methods).map(
                    (method) =>
                        `${method.toUpperCase()} ${prefix}${layer.route!.path.replace(/:(\w+)/g, "{$1}")}`,
                ),
            );

    const registered = [
        ...routesOf(appRoutes as unknown as { stack: Layer[] }, "").filter(
            (route) => !route.endsWith("/demo"), // template reference endpoints
        ),
        ...routesOf(authRoutes as unknown as { stack: Layer[] }, "/auth"),
        ...routesOf(userRoutes as unknown as { stack: Layer[] }, "/user").map((route) => route.replace(/\/$/, "")),
        ...routesOf(cryptoRoutes as unknown as { stack: Layer[] }, "/crypto"),
        ...routesOf(walletRoutes as unknown as { stack: Layer[] }, "/wallet"),
        ...routesOf(bankRoutes as unknown as { stack: Layer[] }, "/banks").map((route) => route.replace(/\/$/, "")),
        ...routesOf(bankAccountRoutes as unknown as { stack: Layer[] }, "/user/bank-accounts").map((route) => route.replace(/\/$/, "")),
        ...routesOf(billRoutes as unknown as { stack: Layer[] }, "/bills"),
        ...routesOf(nairaDepositRoutes as unknown as { stack: Layer[] }, "/naira-deposits").map((route) => route.replace(/\/$/, "")),
    ];

    it("documents every registered route, and nothing that doesn't exist", () => {
        expect(documented.sort()).toEqual(registered.sort());
    });
});
