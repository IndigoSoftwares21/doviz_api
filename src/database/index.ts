import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as monitoring from "@/utils/monitoring";
import { Database } from "./types";

dotenv.config();

// Database connection details
const connectionDetails = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    // Local Postgres (including this template's docker-compose service)
    // doesn't support SSL — only enable it for hosts that require it.
    ssl:
        process.env.DB_SSL === "true"
            ? { rejectUnauthorized: false }
            : undefined,
};

// Validate connection details
console.log("Connecting to PostgreSQL database with Kysely...");
if (!connectionDetails.host) {
    console.error("Database host is missing.");
    process.exit(1);
}
if (!connectionDetails.user) {
    console.error("Database user is missing.");
    process.exit(1);
}
if (!connectionDetails.password) {
    console.error("Database password is missing.");
    process.exit(1);
}
if (!connectionDetails.database) {
    console.error("Database name is missing.");
    process.exit(1);
}
if (!connectionDetails.port) {
    console.error("Database port is missing.");
    process.exit(1);
}

// Create a PostgreSQL connection pool
const pool = new Pool({
    ...connectionDetails,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Setup connection error handling
pool.on("error", (err) => {
    monitoring.error("Unexpected PostgreSQL client error", err);
});

// Create Kysely instance with the generated Database type
export const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    plugins: [
       new CamelCasePlugin(),
    ],
});

// Transaction management
export async function withTransaction<T>(
    callback: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
    return db.transaction().execute(callback);
}

// Helper function to disconnect from the database
export async function disconnect(): Promise<void> {
    await db.destroy();
}

// Export a default instance for convenience
export default db;
