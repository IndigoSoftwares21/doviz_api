// scripts/create-migration.ts
import { execSync } from "child_process";
import { resolve } from "path";
import fs from "fs";

// Get the migration name from command line arguments
// When using npm run migrate:new -- add_demo_table, the migration name is in process.argv[2]
const migrationName = process.argv[2];

if (!migrationName) {
    console.error("Please provide a migration name");
    console.error("Usage: npm run migrate:new -- <migration_name>");
    process.exit(1);
}

try {
    // Create the migration
    console.log(`📝 Creating migration: ${migrationName}...`);
    const knexOutput = execSync(`npx knex migrate:make ${migrationName}`, {
        encoding: "utf-8",
    });

    // Extract the created migration file path from the output
    const createdFileMatch = knexOutput.match(/Created Migration: (.+\.ts)/);
    if (!createdFileMatch) {
        throw new Error("Could not determine the created migration file path");
    }

    const migrationPath = createdFileMatch[1];
    console.log(`Migration file created at: ${migrationPath}`);

    // Get the migration file name without the full path
    const migrationFileName = migrationPath.split("/").pop();
    if (!migrationFileName) {
        throw new Error("Could not extract migration file name");
    }

    // Extract the timestamp prefix
    const timestampPrefix = migrationFileName.split("_")[0];

    // Ensure SQL directory exists
    const SQL_DIR = resolve(__dirname, "../migrations/queries");
    if (!fs.existsSync(SQL_DIR)) {
        fs.mkdirSync(SQL_DIR, { recursive: true });
    }

    // Create SQL files with placeholder content
    const upSqlFilePath = resolve(
        SQL_DIR,
        `${timestampPrefix}_${migrationName}.up.sql`,
    );
    const downSqlFilePath = resolve(
        SQL_DIR,
        `${timestampPrefix}_${migrationName}.down.sql`,
    );

    // Create placeholder SQL files
    fs.writeFileSync(
        upSqlFilePath,
        `-- SQL for ${migrationName} up migration\n-- Add your SQL here\n`,
    );
    fs.writeFileSync(
        downSqlFilePath,
        `-- SQL for ${migrationName} down migration\n-- Add your SQL here\n`,
    );

    console.log(`✅ Created SQL files for ${migrationName}`);

    // Update the migration file to use the SQL files
    const migrationContent = fs.readFileSync(migrationPath, "utf8");

    // Check if the migration file already has the correct structure
    if (!migrationContent.includes("fs.readFile")) {
        // Create the updated migration content
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

        // Write the updated content back to the file
        fs.writeFileSync(migrationPath, updatedContent);
        console.log(`✅ Updated migration file to use SQL files`);
    }

    console.log("✨ Migration created successfully!");
    console.log(`📝 Edit the SQL files at:`);
    console.log(`   - ${upSqlFilePath}`);
    console.log(`   - ${downSqlFilePath}`);
    console.log(`Then run: npm run migrate-up:once`);
} catch (error) {
    console.error("Failed to create migration:", error);
    process.exit(1);
}
