import express from "express";
import cryptoRoutes from "@/routes/crypto.routes";
import walletRoutes from "@/routes/wallet.routes";
import bankRoutes from "@/routes/bank.routes";
import bankAccountRoutes from "@/routes/bankAccount.routes";
import signAccessToken from "@/utils/auth/signAccessToken";

process.env.JWT_ACCESS_SECRET = "test-jwt-secret-test-jwt-secret-test-0001";

/** Only this fork's routers, so tests don't depend on the rest of app.ts. */
export const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/app/user/bank-accounts", bankAccountRoutes);
    app.use("/api/v1/app/crypto", cryptoRoutes);
    app.use("/api/v1/app/wallet", walletRoutes);
    app.use("/api/v1/app/banks", bankRoutes);
    return app;
};

export const authHeader = () => `Bearer ${signAccessToken({ userId: "user-1", sessionId: "session-1" })}`;
export const ASSET_ID = "6f9619ff-8b86-4d11-b42d-00c04fc964ff";
export const BANK_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
