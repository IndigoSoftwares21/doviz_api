import { promises as fs } from "fs";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { Kysely, PostgresDialect } from "kysely";

dotenv.config();

interface TableColumn {
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    udt_name: string;
}

interface TableGroups {
    [tableName: string]: TableColumn[];
}

// Column naming for the generated Database interface. Table names (the
// top-level keys) always stay as their real snake_case DB names — only
// column names are affected. Controlled by DB_TYPES_CASE in .env
// ("camel" | "snake"), defaulting to "camel".
const CASE_MODE = (process.env.DB_TYPES_CASE || "camel").toLowerCase();

function toCamelCase(column: string): string {
    return column.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function toPropertyName(column: string): string {
    return CASE_MODE === "snake" ? column : toCamelCase(column);
}

async function main() {
    // Add a small delay to ensure migrations have fully completed
    await new Promise((resolve) => setTimeout(resolve, 1000));

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

    const pool = new Pool({
        ...connectionDetails,
        max: 2, // Limit connections for this script
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
    });

    try {
        // Query to get all tables and their columns
        const result = await pool.query(`
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.udt_name
      FROM 
        information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE 
        t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY 
        t.table_name,
        c.ordinal_position
    `);

        const tables = result.rows as TableColumn[];

        // Generate TypeScript interfaces
        let typeDefinitions = `/**
 * This file was automatically generated.
 * DO NOT MODIFY IT MANUALLY.
 *
 * Column names are ${CASE_MODE === "snake" ? "snake_case" : "camelCase"} (DB_TYPES_CASE=${CASE_MODE}).
 * Table names always match the real DB table names.
 */

import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// Database interface with auto-generated fields wrapped in Generated<>
export interface Database {
`;

        const tableGroups: TableGroups = tables.reduce((acc, row) => {
            if (!acc[row.table_name]) {
                acc[row.table_name] = [];
            }
            acc[row.table_name].push(row);
            return acc;
        }, {} as TableGroups);

        // PostgreSQL to TypeScript type mapping
        const typeMap: Record<string, string> = {
            integer: "number",
            bigint: "number",
            numeric: "number",
            decimal: "number",
            real: "number",
            "double precision": "number",
            smallint: "number",
            text: "string",
            "character varying": "string",
            varchar: "string",
            char: "string",
            boolean: "boolean",
            timestamp: "Date",
            "timestamp with time zone": "Date",
            "timestamp without time zone": "Date",
            date: "Date",
            time: "string",
            json: "unknown",
            jsonb: "unknown",
            uuid: "string",
        };

        // Generate interface for each table
        Object.entries(tableGroups).forEach(([tableName, columns]) => {
            typeDefinitions += `  ${tableName}: {
`;

            columns.forEach((column) => {
                const isNullable =
                    column.is_nullable === "YES" ? " | null" : "";
                const hasDefault = column.column_default !== null;
                const isGenerated =
                    hasDefault &&
                    column.column_default !== null &&
                    (column.column_default.startsWith("nextval") ||
                        column.column_default.includes("uuid_generate") ||
                        column.column_default.includes("now()") ||
                        column.column_default.includes("CURRENT_TIMESTAMP") ||
                        column.column_default.includes("CURRENT_DATE") ||
                        column.column_default.includes("gen_random_uuid()") ||
                        column.column_default.includes("uuid()") ||
                        column.column_name === "id" || // Most IDs are auto-generated
                        column.column_name === "created_at" || // Timestamps are often auto-generated
                        column.column_name === "updated_at");

                let tsType = typeMap[column.data_type] || "unknown";

                // Handle arrays
                if (column.data_type === "ARRAY") {
                    const elementType =
                        typeMap[column.udt_name.replace("_", "")] || "unknown";
                    tsType = `${elementType}[]`;
                }

                // Make auto-generated fields optional
                const propertyName = toPropertyName(column.column_name);
                if (isGenerated) {
                    // Generated<T>: optional on insert, always present on select.
                    typeDefinitions += `    ${propertyName}: Generated<${tsType}${isNullable}>;
`;
                } else {
                    typeDefinitions += `    ${propertyName}: ColumnType<${tsType}${isNullable}>;
`;
                }
            });

            typeDefinitions += `  };

`;
        });

        typeDefinitions += `}

// Utility types for better type safety
export type Row<Table extends keyof Database> = Selectable<Database[Table]>;
export type InsertRow<Table extends keyof Database> = Insertable<Database[Table]>;
export type UpdateRow<Table extends keyof Database> = Updateable<Database[Table]>;
`;

        // Write the generated types to a file
        await fs.writeFile("src/database/types.ts", typeDefinitions);

        console.log("✨ Database types generated successfully!");
    } finally {
        await pool.end();
    }
}

main().catch(console.error);
