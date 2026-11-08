import { knex } from "knex";
import config from "../knexfile";

async function fixMigrations() {
    const db = knex(config.development);

    try {
        // Delete the problematic migration from the knex_migrations table
        await db("knex_migrations")
            .where("name", "20250412212525_add_sample_categories.ts")
            .delete();

        console.log(
            "✅ Successfully removed problematic migration from the database",
        );
    } catch (error) {
        console.error("Failed to fix migrations:", error);
    } finally {
        await db.destroy();
    }
}

fixMigrations();
