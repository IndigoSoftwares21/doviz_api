# AI Agent Guide

You are coding in a Node/TypeScript repo using Express, Kysely, and Zod with a layered architecture and strict naming. Follow this guide when adding or changing an endpoint so the codebase stays consistent end-to-end.

## CRITICAL: READ THIS FIRST

- **Never wrap or transform a Kysely query result.** `db` (from `@/database`) has Kysely's `CamelCasePlugin` enabled, and `src/database/types.ts` is generated with **camelCase column names by default** (`DB_TYPES_CASE=camel` in `.env`). This means `.select()`/`.where()`/`.values()`/`.returning()` already take camelCase column names, and every query result is already correctly typed and shaped as camelCase — `row.createdAt`, `row.userId`, etc. **There is no `camelKeys()` helper in this codebase and there must not be one.** Do not invent one, do not import one from memory of other codebases, and do not manually convert result objects. If you find yourself writing snake_case anywhere in a query builder call or transforming a result's keys, stop — that's the wrong pattern here.
  ```typescript
  // CORRECT — just return the row, it's already camelCase
  const row = await db.selectFrom("orders").selectAll().executeTakeFirst();
  return row ?? null;
  // row.orderNumber, row.createdAt — already correct, no wrapping

  // WRONG — do not do either of these
  const row = await db.selectFrom("orders").select(["order_number"])...; // snake_case column reference
  return camelKeys(row); // camelKeys does not exist in this codebase
  ```
  Table names are unaffected by any of this — `selectFrom`/`insertInto`/joins always use the real DB table name (e.g. `"orders"`, `"local_governments"`).
- ALWAYS use `parseAsync()` for ANY async validation (database checks, file uploads, etc.) — never `parse()`.
- Use `superRefine` for complex async validation, multi-field dependencies, or when you need to return multiple errors. Use `refine` for simple single-field existence checks.
- Move ALL existence and validity checks to the Schema layer using `schemaHelpers`. The Action layer should assume valid, existing data.
- Keep queries SIMPLE — just data retrieval, no transformations, no error throwing.
- Be CONSISTENT with return value naming across all layers.
- Follow EXACT existing patterns — don't invent new approaches. See the `demo` domain (below) for a complete worked example.
- NEVER use `selectAll()` — always explicitly list required columns to prevent data leakage.
- ALWAYS destructure inputs (`req.body`, objects) — NEVER spread them. Explicit argument passing only.
- Prefer ONE function per file for clean separation of concerns.

## Reference implementation

The `demo` domain is a complete, working, tested example of every layer described in this guide — read it before building a new domain:

- Route: [src/routes/app.routes.ts](src/routes/app.routes.ts)
- Controllers: [src/controllers/demo/get/index.ts](src/controllers/demo/get/index.ts), [src/controllers/demo/post/index.ts](src/controllers/demo/post/index.ts)
- Controller schemas: [src/controllers/demo/get/schema/getDemoSchema.ts](src/controllers/demo/get/schema/getDemoSchema.ts), [src/controllers/demo/post/schema/postDemoSchema.ts](src/controllers/demo/post/schema/postDemoSchema.ts)
- Actions: [src/actions/demo/fetchDemo/index.ts](src/actions/demo/fetchDemo/index.ts), [src/actions/demo/createDemo/index.ts](src/actions/demo/createDemo/index.ts)
- Queries: [src/actions/demo/fetchDemo/queries/selectDemo.ts](src/actions/demo/fetchDemo/queries/selectDemo.ts), [src/actions/demo/createDemo/queries/insertDemo.ts](src/actions/demo/createDemo/queries/insertDemo.ts)
- SchemaHelper: [src/schemaHelpers/selectDemoByName.ts](src/schemaHelpers/selectDemoByName.ts) (async duplicate-name check used by the POST schema's `superRefine`)

## Naming and verb mapping

| Operation | Controller     | Action          | Query           |
| --------- | -------------- | ---------------- | ---------------- |
| Create    | `post{Domain}` | `create{Domain}` | `insert{Domain}` |
| Read      | `get{Domain}`  | `fetch{Domain}`  | `select{Domain}` |
| Update    | `put{Domain}`  | `modify{Domain}` | `update{Domain}` |
| Delete    | `delete{Domain}` | `remove{Domain}` | `delete{Domain}` |

- Controller read operations: `get*`
- Action read operations: `fetch*` (never `get*` for actions)
- Query read operations: `select*`
- Example: Controller `getDemo` → Action `fetchDemo` → Query `selectDemo`

## Required files and locations

- Route: `src/routes/{domain}.routes.ts`, mounted into [src/routes/app.routes.ts](src/routes/app.routes.ts) (small domains can be added directly to `app.routes.ts`, as `demo` is)
- Controller: `src/controllers/{domain}/{operation}/index.ts`
- Controller schema: `src/controllers/{domain}/{operation}/schema/{operation}{Domain}Schema.ts`
- Action: `src/actions/{domain}/{actionVerb}{Domain}/index.ts`
- Query: `src/actions/{domain}/{actionVerb}{Domain}/queries/{queryVerb}{Domain}.ts`
- SchemaHelpers: `src/schemaHelpers/*` — reusable async validation functions for database checks
- Optional query helpers: `src/actions/{domain}/{actionVerb}{Domain}/queries/utils/{utilName}/index.ts`, with a co-located `{utilName}.test.ts` in the same folder if the util has behavior worth testing directly.

## Tech and style constraints

- Validate inputs with Zod (async checks via `refine`/`superRefine` with schemaHelpers).
- Always refine data in the schema with a schemaHelper — check existing helpers in `src/schemaHelpers/` before creating a new one, and ALWAYS call `parseAsync` (never `parse`) when the schema has async validation.
- Use `handleSuccess` and `handleError` (both in `src/utils/`) in controllers — never build response JSON by hand.
- Use Kysely in queries; observe soft-delete (`deletedAt`) and existing conflict/archive patterns already present in the domain you're touching. Not every table needs soft-delete or an archive flag — only add one when the domain actually needs it.
- Keep imports, naming, and formatting identical to existing files.
- Pagination: default to limit/offset for management tables unless cursor-based pagination is explicitly required.
- When adding sorting, move ordering into a small `queries/utils/apply{Domain}Sorting/index.ts` util.
- One function per file.
- Every function takes a single named-object parameter, never positional args — `({ name }: { name: string })`, not `(name: string)`. This applies at every layer: controllers, actions, queries, schemaHelpers, utils. See every example in this guide. The one exception is Express route handlers themselves (`(req, res)`) — that's Express's own calling convention, not ours, and isn't objectified.

## Spec to provide before writing code

```
Domain: {e.g., product, request, user, shop}
Operation: {post|get|put|delete}
HTTP method and path: {e.g., GET /api/v1/app/{domain}/...}
Controller name: {operation}{Domain}
Action name: {actionVerb}{Domain}
Query name: {queryVerb}{Domain}
Auth: {required|optional|none} and middleware to use
Request params:
  Query: {...}
  Body: {...}
  Path params: {...}
  Files: {multer?}
Response shape: {...}
Sorting/pagination: {none|cursor|offset; fields}
Side effects: {uploads, emails, cache, etc.}
Error cases: {400/401/403/404/409/500 with brief reasons}
```

## Controller requirements

- Parse `req.query`/`req.body`/`req.params`/`req.file`.
- Normalize strings (trim, lowercase) consistent with the codebase.
- Validate via the schema file using `parseAsync()`; pass validated values to the action.
- Always destructure `req.body`/objects — never spread them.
- NEVER pass `req.body`, `req.params`, or `req.query` directly to the schema validator — destructure the required fields first and pass them inside a new object.
- Use named object parameters for all functions.
- Success: `handleSuccess({ res, req, message, data, code: 200|201|204 })`.
- Error: `handleError({ res, req, message, code, error })` — it already knows how to format Zod validation errors and Postgres errors, so just pass the caught `error` through.
- Always destructure action returns: `const { data } = await someAction({ prop1, prop2 })`.

## Schema requirements

- Strong Zod types; preprocess string→boolean/number where needed (see `getDemoSchema.ts`'s `limit` handling).
- Async existence/uniqueness checks via `schemaHelpers/*` using `refine()` or `superRefine()` depending on complexity.
- Cross-field rules via `.refine`/`.superRefine` (use `superRefine` for cross-field or async validation).
- ALWAYS use `parseAsync()` in controllers when the schema has async validation.
- Do NOT re-validate fields already checked by middleware (e.g. auth/permission guards).
- Restrict free-text names to a sane character set where appropriate, e.g. `/^[a-zA-Z0-9\s]+$/`.

## SchemaHelper requirements

- Create in `src/schemaHelpers/` with a descriptive name (e.g. `selectUserById`, `selectDemoByName`).
- Return the found record (with only the columns needed for the check) or `undefined`.
- Used for database existence/uniqueness checks from within schema validation.

```typescript
import { db } from "@/database";

const selectDemoByName = async ({ name }: { name: string }) => {
    const demoRow = await db
        .selectFrom("demo")
        .select(["id"])
        .where("name", "=", name)
        .executeTakeFirst();

    return demoRow;
};

export default selectDemoByName;
```

## Action requirements

- Orchestrate services (uploads, notifications, etc.) and the query, then return the result.
- No DB logic beyond orchestration.
- Keep the return structure consistent — if you return `{ data }`, always return `{ data }`.
- Don't rename destructured properties unnecessarily.

## Query requirements

- Kysely only; explicit `.select()`/`.returning()` columns; `onConflict` patterns match the rest of the repo.
- NEVER use `selectAll()` — always list required columns explicitly to avoid leaking sensitive data.
- Keep queries simple — just data retrieval, no transformations, no error throwing. Let higher layers handle that.
- Return the row(s) directly — no wrapping, no `camelKeys` (see "CRITICAL" above).
- Never `return` an awaited query inline — assign it to a named variable first, then return the variable. This keeps the shape easy to inspect/debug and matches every query in this codebase.

```typescript
const selectDemo = async ({ limit }: { limit: number }) => {
    const demoRows = await db
        .selectFrom("demo")
        .select(["id", "name", "createdAt"])
        .orderBy("createdAt", "desc")
        .limit(limit)
        .execute();

    return demoRows;
};

export default selectDemo;
```

## Common mistakes to avoid

- Using `parse()` instead of `parseAsync()` for async validation.
- Not moving existence/uniqueness checks to the schema layer (leaving them in the Action/Controller).
- Passing `req.body`/`req.params`/`req.query` directly to `schema.parseAsync()` instead of destructuring first.
- Over-engineering queries with transformations — keep them to plain data retrieval.
- Inconsistent return value naming between layers.
- Not creating a required schemaHelper for an async check.
- Adding error throwing in queries instead of letting higher layers handle it.
- Using `selectAll()` instead of explicit column selection.
- Spreading objects/`req.body` instead of explicit destructuring.
- Re-checking middleware-validated fields unnecessarily.
- Putting multiple functions in one file.
- Using `get*` naming for actions — actions must use `fetch*` for reads.
- Using `as any` to cast query results — the generated types are already accurate; if something doesn't type-check, that's real signal, not noise to suppress.
- **Wrapping a query result in `camelKeys()` or writing snake_case column references** — this codebase generates camelCase types natively; there is nothing to wrap.

## Deliverables checklist

- Route wired in the relevant routes file
- New controller, schema, action, query (and helper/sorting util if used)
- SchemaHelper created if async validation is needed
- No regressions; pagination still works; standardized responses (`handleSuccess`/`handleError`) returned
- `npx tsc --noEmit` passes
