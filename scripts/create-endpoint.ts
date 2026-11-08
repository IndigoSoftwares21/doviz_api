#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { camelCase, upperFirst } from 'lodash';
import inquirer from 'inquirer';
import chalk from 'chalk';

async function main() {
    console.log(chalk.bold.cyan('\n🚀 Indigo Express Endpoint Generator\n'));

    const baseDir = path.join(process.cwd(), 'src');
    const routesDir = path.join(baseDir, 'routes');

    let confirmed = false;
    let data : any = {};

    while (!confirmed) {
        // 1. HTTP Method first
        const { method } = await inquirer.prompt([
            {
                type: 'list',
                name: 'method',
                message: 'Select HTTP method:',
                choices: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                default: 'GET',
            }
        ]);

        // 2. Scope - either select existing or enter new
        let existingScopes: string[] = [];
        if (fs.existsSync(routesDir)) {
            const routeFiles = fs.readdirSync(routesDir);
            existingScopes = routeFiles
                .filter((f: string) => f.endsWith('.routes.ts'))
                .map((f: string) => f.replace('.routes.ts', ''));
        }

        let scope = '';
        if (existingScopes.length > 0) {
            const { scopeChoice } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'scopeChoice',
                    message: 'Select or create a scope:',
                    choices: [...existingScopes, new inquirer.Separator(), '+ Create new scope'],
                }
            ]);

            if (scopeChoice === '+ Create new scope') {
                const { newScope } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'newScope',
                        message: 'Enter scope name (e.g., "app", "hub", "admin"):',
                        validate: (input: string) => input.trim().length > 0 || 'Scope name cannot be empty',
                    }
                ]);
                scope = newScope.trim().toLowerCase();
            } else {
                scope = scopeChoice;
            }
        } else {
            const { newScope } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'newScope',
                    message: 'Enter scope name (e.g., "app", "hub", "admin"):',
                    validate: (input: string) => input.trim().length > 0 || 'Scope name cannot be empty',
                }
            ]);
            scope = newScope.trim().toLowerCase();
        }


        // 3. Domain - either select existing or enter new
        const controllersScopeDir = path.join(baseDir, 'controllers', scope);
        let existingDomains: string[] = [];
        if (fs.existsSync(controllersScopeDir)) {
            existingDomains = fs.readdirSync(controllersScopeDir).filter((f: string) => {
                return fs.statSync(path.join(controllersScopeDir, f)).isDirectory();
            });
        }

        let domain = '';
        if (existingDomains.length > 0) {
            const { domainChoice } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'domainChoice',
                    message: 'Select or create a domain:',
                    choices: [...existingDomains, new inquirer.Separator(), '+ Create new domain'],
                }
            ]);

            if (domainChoice === '+ Create new domain') {
                const { newDomain } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'newDomain',
                        message: 'Enter domain name (e.g., "users", "products"):',
                        validate: (input: string) => input.trim().length > 0 || 'Domain name cannot be empty',
                    }
                ]);
                domain = newDomain.trim().toLowerCase();
            } else {
                domain = domainChoice;
            }
        } else {
            const { newDomain } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'newDomain',
                    message: 'Enter domain name (e.g., "users", "products"):',
                    validate: (input: string) => input.trim().length > 0 || 'Domain name cannot be empty',
                }
            ]);
            domain = newDomain.trim().toLowerCase();
        }

        // 4. Custom naming with examples
        const pascalScope = upperFirst(camelCase(scope));
        const pascalDomain = upperFirst(camelCase(domain));

        let actionVerb = '';
        let queryVerb = '';
        let operationPrefix = '';

        switch (method) {
            case 'POST': actionVerb = 'create'; queryVerb = 'insert'; operationPrefix = 'post'; break;
            case 'GET': actionVerb = 'fetch'; queryVerb = 'select'; operationPrefix = 'get'; break;
            case 'PUT': 
            case 'PATCH': actionVerb = 'modify'; queryVerb = 'update'; operationPrefix = method.toLowerCase(); break;
            case 'DELETE': actionVerb = 'remove'; queryVerb = 'delete'; operationPrefix = 'delete'; break;
            default: actionVerb = 'process'; queryVerb = 'execute'; operationPrefix = 'handle';
        }

        const { controllerName, actionName, queryName, routePath, needsSchema } = await inquirer.prompt([
            {
                type: 'input',
                name: 'controllerName',
                message: `Controller name (e.g., "${operationPrefix}${pascalScope}${pascalDomain}"):`,
                default: `${operationPrefix}${pascalScope}${pascalDomain}`,
                validate: (input: string) => input.trim().length > 0 || 'Controller name cannot be empty',
            },
            {
                type: 'input',
                name: 'actionName',
                message: `Action name (e.g., "${actionVerb}${pascalScope}${pascalDomain}"):`,
                default: `${actionVerb}${pascalScope}${pascalDomain}`,
                validate: (input: string) => input.trim().length > 0 || 'Action name cannot be empty',
            },
            {
                type: 'input',
                name: 'queryName',
                message: `Query name (e.g., "${queryVerb}${pascalScope}${pascalDomain}"):`,
                default: `${queryVerb}${pascalScope}${pascalDomain}`,
                validate: (input: string) => input.trim().length > 0 || 'Query name cannot be empty',
            },
            {
                type: 'input',
                name: 'routePath',
                message: `Route path (e.g., "/${domain}"):`,
                default: `/${domain}`,
                validate: (input: string) => input.trim().length > 0 || 'Route path cannot be empty',
            },
            {
                type: 'confirm',
                name: 'needsSchema',
                message: 'Do you need a Zod schema file?',
                default: true,
            }
        ]);


        const operationName = controllerName;


        console.log(chalk.bold.yellow('\n--- Configuration Preview ---'));
        console.log(`${chalk.blue('Method:')}      ${method}`);
        console.log(`${chalk.blue('Scope:')}       ${scope}`);
        console.log(`${chalk.blue('Domain:')}      ${domain}`);
        console.log(`${chalk.blue('Controller:')}  ${controllerName}`);
        console.log(`${chalk.blue('Action:')}      ${actionName}`);
        console.log(`${chalk.blue('Query:')}       ${queryName}`);
        console.log(`${chalk.blue('Route:')}       ${method} ${routePath}`);
        console.log(`${chalk.blue('Schema:')}      ${needsSchema ? 'Yes' : 'No'}`);
        console.log(chalk.bold.yellow('-----------------------------\n'));

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Does this look correct?',
                default: true,
            }
        ]);

        if (confirm) {
            confirmed = true;
            data = {
                method, scope, domain, operationName, needsSchema, controllerName, actionName, queryName, routePath
            };
        } else {
            console.log(chalk.red('\n🔄 Restarting configuration...\n'));
        }
    }

    const { method, scope, domain, operationName, needsSchema, controllerName, actionName, queryName, routePath } = data;

    // Paths
    const controllerDir = path.join(baseDir, 'controllers', scope, domain, operationName);
    const actionDir = path.join(baseDir, 'actions', scope, domain, actionName);
    const queryDir = path.join(actionDir, 'queries');
    const routeFile = path.join(baseDir, 'routes', `${scope}.routes.ts`);

    // Create directories
    if (!fs.existsSync(controllerDir)) fs.mkdirSync(controllerDir, { recursive: true });
    if (needsSchema && !fs.existsSync(path.join(controllerDir, 'schema'))) fs.mkdirSync(path.join(controllerDir, 'schema'), { recursive: true });
    if (!fs.existsSync(queryDir)) fs.mkdirSync(queryDir, { recursive: true });

    // 1. Controller Template
    const controllerTemplate = `import { Request, Response } from "express";
import handleError from "@/utils/handleError";
import handleSuccess from "@/utils/handleSuccess";
import ${actionName} from "@/actions/${scope}/${domain}/${actionName}";
${needsSchema ? `import ${operationName}Schema from "./schema/${operationName}.schema";` : ''}

const ${controllerName} = async (req: Request, res: Response) => {
    try {
        ${needsSchema 
            ? `const validatedData = await ${operationName}Schema.parseAsync({});`
            : '// const validatedData = {};'
        }

        const { data } = await ${actionName}({
            // pass data here
        });

        return handleSuccess({
            req,
            res,
            message: "Operation successful",
            data,
            code: ${method === 'POST' ? '201' : '200'},
        });
    } catch (error) {
        return handleError({
            req,
            res,
            error,
        });
    }
};

export default ${controllerName};
`;

    fs.writeFileSync(path.join(controllerDir, 'index.ts'), controllerTemplate);

    // 2. Schema Template
    if (needsSchema) {
        const schemaTemplate = `import { z } from "zod";

const ${operationName}Schema = z.object({
    // Define your schema here
});

export default ${operationName}Schema;
`;
        fs.writeFileSync(path.join(controllerDir, 'schema', `${operationName}.schema.ts`), schemaTemplate);
    }

    // 3. Action Template
    const actionTemplate = `import ${queryName} from "./queries/${queryName}";

export const ${actionName} = async ({}: {}) => {
    const { data } = await ${queryName}({});

    return {
        data,
    };
};

export default ${actionName};
`;
    fs.writeFileSync(path.join(actionDir, 'index.ts'), actionTemplate);

    // 4. Query Template
    const queryTemplate = `import { db } from "@/database";
import { camelKeys } from "@/database/utils";

export const ${queryName} = async ({}: {}) => {
    // const result = await db.selectFrom("table").selectAll().execute();
    // return { data: camelKeys(result) };
    return { data: null };
};

export default ${queryName};
`;
    fs.writeFileSync(path.join(queryDir, `${queryName}.ts`), queryTemplate);

    // 5. Route Update
    if (!fs.existsSync(path.dirname(routeFile))) {
        fs.mkdirSync(path.dirname(routeFile), { recursive: true });
    }

    let routeContent = '';
    if (fs.existsSync(routeFile)) {
        routeContent = fs.readFileSync(routeFile, 'utf8');
    } else {
        routeContent = `import { Router } from "express";

const router = Router();

export default router;
`;
    }

    const importStatement = `import ${controllerName} from "@/controllers/${scope}/${domain}/${operationName}";`;
    const routeStatement = `router.${method.toLowerCase()}("${routePath}", ${controllerName});`;

    let lines = routeContent.split('\n');
    
    // Add import if not exists
    if (!routeContent.includes(importStatement)) {
        const reversedIndex = [...lines].reverse().findIndex((line: string) => line.startsWith('import'));
        let lastImportIndex = reversedIndex === -1 ? -1 : lines.length - 1 - reversedIndex;
        if (lastImportIndex === -1) lastImportIndex = -1;
        lines.splice(lastImportIndex + 1, 0, importStatement);
    }
    
    // Add route if not exists
    if (!routeContent.includes(routeStatement)) {
        let exportIndex = lines.findIndex((line: string) => line.startsWith('export default'));
        if (exportIndex === -1) {
            lines.push(routeStatement);
        } else {
            lines.splice(exportIndex, 0, routeStatement);
        }
    }

    fs.writeFileSync(routeFile, lines.join('\n'));

    console.log(chalk.bold.green('\n✅ Endpoint created successfully!\n'));
    console.log(`${chalk.blue('Controller:')} src/controllers/${scope}/${domain}/${operationName}`);
    console.log(`${chalk.blue('Action:')}     src/actions/${scope}/${domain}/${actionName}`);
    console.log(`${chalk.blue('Query:')}      src/actions/${scope}/${domain}/${actionName}/queries/${queryName}.ts`);
    if (needsSchema) {
        console.log(`${chalk.blue('Schema:')}     src/controllers/${scope}/${domain}/${operationName}/schema/${operationName}.schema.ts`);
    }
    console.log(`${chalk.blue('Route:')}      src/routes/${scope}.routes.ts`);
    console.log(chalk.cyan('\nHappy coding! 🚀\n'));
}

main().catch(err => {
    console.error(chalk.red('\n❌ Error:'), err);
    process.exit(1);
});
