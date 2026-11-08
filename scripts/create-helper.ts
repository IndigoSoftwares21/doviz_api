#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { camelCase } from 'lodash';
import inquirer from 'inquirer';
import chalk from 'chalk';

async function main() {
    console.log(chalk.bold.cyan('\n🔍 Indigo Express Schema Helper Generator\n'));

    const baseDir = path.join(process.cwd(), 'src');
    const helperDir = path.join(baseDir, 'schemaHelpers');

    if (!fs.existsSync(helperDir)) {
        fs.mkdirSync(helperDir, { recursive: true });
    }

    const { rawName } = await inquirer.prompt([
        {
            type: 'input',
            name: 'rawName',
            message: 'Enter helper name (e.g., "select user by id"):',
            validate: (input: string) => input.trim().length > 0 || 'Helper name cannot be empty',
        }
    ]);

    const helperName = camelCase(rawName);

    const helperTemplate = `import { db } from "@/database";
import { camelKeys } from "@/database/utils";

/**
 * Reusable schema helper for async validation
 */
export const ${helperName} = async ({}: {}) => {
    const result = await db
        .selectFrom("")
        .select([])
        .where("", "=", "")
        .executeTakeFirst();
    
    return result ? camelKeys(result) : null;
};

export default ${helperName};
`;

    const filePath = path.join(helperDir, `${helperName}.ts`);
    if (fs.existsSync(filePath)) {
        const { overwrite } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'overwrite',
                message: `Helper ${chalk.red(helperName)} already exists. Overwrite?`,
                default: false,
            }
        ]);
        if (!overwrite) {
            console.log(chalk.yellow('\nOperation cancelled.'));
            process.exit(0);
        }
    }

    fs.writeFileSync(filePath, helperTemplate);

    console.log(chalk.bold.green('\n✅ Schema helper created successfully!\n'));
    console.log(`${chalk.blue('File:')} src/schemaHelpers/${helperName}.ts`);
    console.log(chalk.cyan('\nHappy coding! 🚀\n'));
}

main().catch(err => {
    console.error(chalk.red('\n❌ Error:'), err);
    process.exit(1);
});
