import checkKycKeys from "@/services/kycVault/checkKycKeys";
import express from "express";
import type { Server } from "http";
import { disconnect } from "@/database";
import { handleMulterError } from "@/middlewares/multer";
import appRoutes from "@/routes/app.routes";
import docsRoutes from "@/routes/docs.routes";
import webhookRoutes from "@/routes/webhook.routes";
import registerCryptoProviders from "@/services/crypto/providers";
import registerBillProviders from "@/services/bills/providers";
import registerCollectionProviders from "@/services/collections/providers";
import registerPayoutProviders from "@/services/payouts/providers";
import registerCryptoSendProviders from "@/services/cryptoSends/providers";
import startJobs from "@/jobs/startJobs";
import startRealtime from "@/services/realtime/startRealtime";

import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import monitoring from "./utils/monitoring";
const corsOptions = {
    origin: [process.env.CORS_ORIGIN || "http://localhost:5173"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
};

class App {
    public express: express.Application;
    public server?: Server;

    constructor() {
        this.express = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.express.set("trust proxy", 1);
    }

    private initializeMiddlewares(): void {
        this.express.use(cors(corsOptions));
        // KYC submissions carry a selfie (≤1.5 MB as base64): a larger body
        // limit for that one route only; everything else keeps the 100 KB default.
        this.express.use(`/api/${process.env.API_VERSION || "v1"}/app/user/kyc`, express.json({ limit: "2.5mb" }));
        this.express.use(express.json());
        this.express.use(helmet());
        this.express.use(helmet.xssFilter());
        this.express.use(express.urlencoded({ extended: true }));
        this.express.use((req, res, next) => {
            res.setHeader("Content-Security-Policy", "default-src 'self'");
            res.setHeader("Strict-Transport-Security", "max-age=31536000");
            next();
        });
        this.express.use(handleMulterError);

        this.express.use((req, res, next) => {
            monitoring.info(`${req.method} ${req.path}`);
            next();
        });

        if (process.env.APP_ENVIRONMENT === "PRODUCTION") {
            // 30 requests per minute per IP
            const limiter = rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minute
                max: 60, // limit each IP to 30 requests per windowMs
                // Provider webhooks come from a few fixed IPs in bursts; a 429
                // would only delay money events (they're verified per provider).
                skip: (req) => req.path.startsWith(`/api/${process.env.API_VERSION || "v1"}/webhooks/`),
            });
            this.express.use(limiter);
        }
    }

    private initializeRoutes(): void {
        monitoring.info("Initializing routes");

        // Crypto/payout/bill providers must be registered before any route uses them.
        registerCryptoProviders();
        registerBillProviders();
        registerCollectionProviders();
        registerPayoutProviders();
        registerCryptoSendProviders();
        checkKycKeys();
        
        const apiVersion = process.env.API_VERSION || 'v1';
        
        // Register route modules here
        this.express.use(`/api/${apiVersion}/app`, appRoutes);
        monitoring.info(`Registered route: /api/${apiVersion}/app`);

        this.express.use(`/api/${apiVersion}/webhooks`, webhookRoutes);
        monitoring.info(`Registered route: /api/${apiVersion}/webhooks`);

        // Password-protected API reference (disabled unless DOCS_* env is set)
        this.express.use("/docs", docsRoutes);
    }

    public async start(
        port: number,
        maxPortAttempts = 10,
    ): Promise<void> {
        // Only the chosen env file: `npm run dev:prod` sets DOTENV_CONFIG_PATH=.env.production, so .env is never read.
        dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

        let currentPort = port;

        for (let attempt = 0; attempt < maxPortAttempts; attempt++) {
            try {
                await this.listen(currentPort);
                if (currentPort !== port) {
                    monitoring.info(
                        `Port ${port} was in use — started on ${currentPort} instead.`,
                    );
                }
                return;
            } catch (error) {
                if (!isPortInUseError(error)) {
                    monitoring.error("Failed to start server:", error as Error);
                    await disconnect();
                    process.exit(1);
                }
                currentPort += 1;
            }
        }

        monitoring.error(
            "Failed to start server:",
            new Error(
                `No free port found after trying ${port}-${currentPort - 1}.`,
            ),
        );
        await disconnect();
        process.exit(1);
    }

    private listen(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const server = this.express.listen(port);

            server.once("listening", () => {
                this.server = server;
                // Push events to signed-in devices (only in a real server, never in tests).
                startRealtime({ server });
                monitoring.info(`Server running on port ${port}`);
                resolve();
            });

            server.once("error", (error) => {
                server.removeAllListeners();
                reject(error);
            });
        });
    }
}

function isPortInUseError(error: unknown): boolean {
    return (
        !!error &&
        typeof error === "object" &&
        (error as NodeJS.ErrnoException).code === "EADDRINUSE"
    );
}

const app = new App();

// Only auto-start the server when this file is run directly (e.g. `node
// dist/app.js`) — importing it (for example from a test) should not bind
// a real port.
if (require.main === module) {
    const PORT = parseInt(process.env.PORT || "6969", 10);
    // Background jobs run only in a real server process, never in tests.
    app.start(PORT).then(() => startJobs());
}

export default app;
