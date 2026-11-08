import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Paths
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations/scripts");
const SQL_DIR = path.resolve(__dirname, "../migrations/queries");

// Ensure SQL directory exists
if (!fs.existsSync(SQL_DIR)) {
    fs.mkdirSync(SQL_DIR, { recursive: true });
}

// Get all migration files
const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));

console.log(`Found ${migrationFiles.length} migration files`);

// Process each migration file
migrationFiles.forEach((file) => {
    // Extract the timestamp prefix and migration name
    const parts = file.split("_");
    if (parts.length < 2) {
        console.log(`Skipping file ${file} - doesn't match expected format`);
        return;
    }

    const timestampPrefix = parts[0];
    const migrationName = parts.slice(1).join("_").replace(".ts", "");

    const upSqlFileName = `${timestampPrefix}_${migrationName}.up.sql`;
    const downSqlFileName = `${timestampPrefix}_${migrationName}.down.sql`;
    const upSqlFilePath = path.join(SQL_DIR, upSqlFileName);
    const downSqlFilePath = path.join(SQL_DIR, downSqlFileName);

    // Skip if both SQL files already exist
    if (fs.existsSync(upSqlFilePath) && fs.existsSync(downSqlFilePath)) {
        console.log(`SQL files for ${file} already exist, skipping`);
        return;
    }

    console.log(`Creating SQL files for ${file}...`);

    try {
        // Create up SQL file if it doesn't exist
        if (!fs.existsSync(upSqlFilePath)) {
            console.log(`Creating up SQL for ${file}...`);
            fs.writeFileSync(
                upSqlFilePath,
                `-- SQL for ${migrationName} up migration\n-- Add your SQL here\n`,
            );
            console.log(`✅ Created up SQL for ${file}`);
        }

        // Create down SQL file if it doesn't exist
        if (!fs.existsSync(downSqlFilePath)) {
            console.log(`Creating down SQL for ${file}...`);
            fs.writeFileSync(
                downSqlFilePath,
                `-- SQL for ${migrationName} down migration\n-- Add your SQL here\n`,
            );
            console.log(`✅ Created down SQL for ${file}`);
        }

        // Update the migration file to use the SQL files if needed
        const migrationPath = path.join(MIGRATIONS_DIR, file);
        const migrationContent = fs.readFileSync(migrationPath, "utf8");

        if (!migrationContent.includes("fs.readFile")) {
            console.log(`Updating migration file ${file} to use SQL files...`);
            const updatedContent = `import { Knex } from 'knex';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function up(knex: Knex): Promise<void> {
  const migrationName = path.basename(__filename, '.ts');
  const sqlPath = path.resolve(__dirname, '../queries', \`\${migrationName}.up.sql\`);
  const sql = await fs.readFile(sqlPath, 'utf8');
  await knex.raw(sql);
}

export async function down(knex: Knex): Promise<void> {
  const migrationName = path.basename(__filename, '.ts');
  const sqlPath = path.resolve(__dirname, '../queries', \`\${migrationName}.down.sql\`);
  const sql = await fs.readFile(sqlPath, 'utf8');
  await knex.raw(sql);
}`;

            fs.writeFileSync(migrationPath, updatedContent);
            console.log(`✅ Updated migration file ${file} to use SQL files`);
        }
    } catch (error) {
        console.error(`❌ Failed to create SQL for ${file}:`, error);
    }
});

console.log("SQL file creation complete!");
